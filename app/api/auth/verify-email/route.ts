import { NextRequest, NextResponse } from 'next/server';
import { CognitoUserPool, CognitoUser } from 'amazon-cognito-identity-js';

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

const userPool = new CognitoUserPool(poolData);

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

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
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
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

        resolve(
          NextResponse.json(
            {
              message: 'Email verified successfully',
              verified: true,
            },
            { status: 200 }
          )
        );
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

