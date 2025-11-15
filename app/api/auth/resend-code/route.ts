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
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          console.error('Cognito resend code error:', err);
          resolve(
            NextResponse.json(
              { error: err.message || 'Failed to resend confirmation code' },
              { status: 400 }
            )
          );
          return;
        }

        resolve(
          NextResponse.json(
            {
              message: 'Confirmation code has been resent to your email',
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

