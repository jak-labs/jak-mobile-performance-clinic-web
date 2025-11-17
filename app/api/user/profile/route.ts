import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getUserProfile } from '@/lib/dynamodb';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile from jak-users table
    let userProfile = await getUserProfile(session.user.id);

    // If profile doesn't exist, create it with basic info from session
    if (!userProfile) {
      console.log('Profile not found, creating new profile for user:', session.user.id);
      console.log('Session data:', { id: session.user.id, email: session.user.email, name: session.user.name });
      
      try {
        const { saveUserProfile } = await import('@/lib/dynamodb');
        
        // Parse name from session into f_name and l_name
        const nameParts = session.user.name ? session.user.name.split(' ') : [];
        const f_name = nameParts[0] || undefined;
        const l_name = nameParts.slice(1).join(' ') || undefined;
        
        // Create profile with email and name from session
        await saveUserProfile({
          userId: session.user.id,
          email: session.user.email || '',
          fullName: session.user.name || undefined,
          f_name: f_name,
          l_name: l_name,
        });
        
        console.log('Profile saved successfully, fetching...');
        
        // Fetch the newly created profile
        userProfile = await getUserProfile(session.user.id);
        
        if (!userProfile) {
          console.error('Profile was saved but could not be retrieved');
          return NextResponse.json(
            { error: 'Failed to create user profile - profile saved but not retrievable' },
            { status: 500 }
          );
        }
        
        console.log('Profile created and retrieved successfully:', userProfile);
      } catch (createError: any) {
        console.error('Error creating profile:', createError);
        return NextResponse.json(
          { error: `Failed to create user profile: ${createError.message || createError.toString()}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { user: userProfile },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode
    });
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get user profile',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fullName, practiceName, email } = body;

    // Update user profile in jak-users table
    const { updateUserProfile } = await import('@/lib/dynamodb');
    
    await updateUserProfile(session.user.id, {
      ...(fullName !== undefined && { fullName }),
      ...(practiceName !== undefined && { practiceName }),
      ...(email !== undefined && { email }),
    });

    // Fetch updated profile
    const updatedProfile = await getUserProfile(session.user.id);

    return NextResponse.json(
      { user: updatedProfile },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user profile' },
      { status: 500 }
    );
  }
}

