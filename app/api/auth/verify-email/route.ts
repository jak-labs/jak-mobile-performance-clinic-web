import { NextRequest, NextResponse } from 'next/server';
import { CognitoUserPool, CognitoUser } from 'amazon-cognito-identity-js';
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { saveUserProfile } from '@/lib/dynamodb';
import { saveSubjectProfile } from '@/lib/dynamodb-subjects';

// Lazy initialization functions to avoid checking env vars at build time
function getUserPool() {
  if (!process.env.COGNITO_CLIENT_ID || !process.env.COGNITO_ISSUER) {
    throw new Error('Missing required environment variables for Cognito authentication');
  }

  // Extract UserPoolId from COGNITO_ISSUER
  const userPoolId = process.env.COGNITO_ISSUER.split('/').pop();
  if (!userPoolId) {
    throw new Error('Invalid COGNITO_ISSUER format');
  }

  const poolData = {
    UserPoolId: userPoolId,
    ClientId: process.env.COGNITO_CLIENT_ID
  };

  return new CognitoUserPool(poolData);
}

function getUserPoolId() {
  if (!process.env.COGNITO_ISSUER) {
    throw new Error('Missing required environment variables for Cognito authentication');
  }
  const userPoolId = process.env.COGNITO_ISSUER.split('/').pop();
  if (!userPoolId) {
    throw new Error('Invalid COGNITO_ISSUER format');
  }
  return userPoolId;
}

function getCognitoClient() {
  // Use JAK_ prefixed vars for Netlify (AWS_* are reserved), fallback to AWS_* for local dev
  return new CognitoIdentityProviderClient({
    region: process.env.JAK_AWS_REGION || process.env.AWS_REGION || 'us-east-2',
    credentials: (process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
      ? {
          accessKeyId: process.env.JAK_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.JAK_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, fullName } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and confirmation code are required' },
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Confirmation code must be 6 digits' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const userPool = getUserPool();
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.confirmRegistration(code, true, async (err, result) => {
        if (err) {
          console.error('Cognito confirmation error:', err);
          resolve(
            NextResponse.json(
              { error: err.message || 'Failed to verify email' },
              { status: 400 }
            )
          );
          return;
        }

        // Get user's groups to determine if they're a Coach or Member
        try {
          const cognitoClient = getCognitoClient();
          const userPoolId = getUserPoolId();

          // Get user's groups
          const groupsResponse = await cognitoClient.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: userPoolId,
              Username: email,
            })
          );

          const groups = groupsResponse.Groups || [];
          const isMember = groups.some((g) => g.GroupName === 'Member');
          const isCoach = groups.some((g) => g.GroupName === 'Coach');
          
          console.log('User groups after verification:', groups.map(g => g.GroupName));
          console.log('isCoach:', isCoach, 'isMember:', isMember);

          // Get user attributes including sub and name
          const userResponse = await cognitoClient.send(
            new AdminGetUserCommand({
              UserPoolId: userPoolId,
              Username: email,
            })
          );

          // Get sub from user attributes
          const subAttribute = userResponse.UserAttributes?.find((attr) => attr.Name === 'sub');
          const userId = subAttribute?.Value || email;
          
          // Get name from Cognito attributes if fullName not provided in request
          const nameAttribute = userResponse.UserAttributes?.find((attr) => attr.Name === 'name');
          const cognitoName = nameAttribute?.Value;
          const finalFullName = fullName || cognitoName || undefined;

          // Save to appropriate DynamoDB table based on group
          if (isMember) {
            // Check if subject profile already exists (from invite migration)
            // If they signed up with an invite, migratePendingSubjectToActive already created the profile
            // We should only create a new profile if one doesn't exist
            const { getSubjectProfile, updateSubjectProfile } = await import('@/lib/dynamodb-subjects');
            
            // Try to find existing profile by scanning (since we only have subject_id, not owner_id)
            // If profile exists, it means they signed up with an invite - don't overwrite it
            let existingProfile = null;
            try {
              // Use getSubjectProfile which scans for subject_id
              existingProfile = await getSubjectProfile(userId);
            } catch (scanError) {
              console.error('Error checking for existing profile:', scanError);
              // Continue - we'll try to create/update anyway
            }
            
            // Parse fullName into f_name and l_name if provided
            const nameParts = finalFullName ? finalFullName.split(' ') : [];
            const f_name = nameParts[0] || '';
            const l_name = nameParts.slice(1).join(' ') || '';

            if (existingProfile) {
              // Profile already exists (from invite migration) - just update name fields if provided
              // This preserves the existing owner_id (coach's ID) from the invite
              if (fullName) {
                await updateSubjectProfile(
                  userId,
                  {
                    name: fullName,
                    full_name: fullName,
                    f_name: f_name || undefined,
                    l_name: l_name || undefined,
                  },
                  existingProfile.owner_id // Preserve the existing owner_id (coach's ID)
                );
              }
            } else {
              // No existing profile - create new one (direct signup without invite)
              await saveSubjectProfile({
                owner_id: userId, // For direct signups, owner is themselves
                subject_id: userId,
                email,
                name: fullName,
                full_name: fullName,
                f_name: f_name || undefined,
                l_name: l_name || undefined,
              });
            }
          } else if (isCoach) {
            // Parse fullName into f_name and l_name for coaches
            const nameParts = fullName ? fullName.split(' ') : [];
            const f_name = nameParts[0] || undefined;
            const l_name = nameParts.slice(1).join(' ') || undefined;
            
            console.log('Saving coach profile to jak-users:', { userId, email, fullName, f_name, l_name });
            
            try {
              const { saveUserProfile } = await import('@/lib/dynamodb');
              await saveUserProfile({
                userId: userId,
                email,
                fullName: fullName || undefined,
                f_name: f_name,
                l_name: l_name,
              });
              console.log('Coach profile saved successfully to jak-users');
            } catch (saveError: any) {
              console.error('ERROR SAVING COACH PROFILE:', saveError);
              console.error('Error details:', {
                message: saveError.message,
                name: saveError.name,
                code: saveError.code,
                stack: saveError.stack
              });
              throw saveError; // Re-throw to be caught by outer catch
            }
          } else {
            // User is not in any group - log warning but don't save
            console.warn('User is not in Coach or Member group. Groups:', groups.map(g => g.GroupName));
          }

          resolve(
            NextResponse.json(
              {
                message: 'Email verified successfully',
                verified: true,
              },
              { status: 200 }
            )
          );
        } catch (dbError: any) {
          console.error('ERROR SAVING USER PROFILE AFTER VERIFICATION:', dbError);
          console.error('Error details:', {
            message: dbError.message,
            name: dbError.name,
            code: dbError.code,
            stack: dbError.stack
          });
          // Return error so user knows something went wrong
          resolve(
            NextResponse.json(
              {
                error: 'Email verified but failed to save profile',
                message: dbError.message || 'Failed to save user profile',
                verified: true,
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error occurred' },
      { status: 500 }
    );
  }
}

