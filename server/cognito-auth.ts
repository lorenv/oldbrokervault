import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  ResendConfirmationCodeCommand,
  AttributeType,
  MessageActionType,
  DeliveryMediumType,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AuthFlowType,
  ChallengeNameType,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { logger } from './logger';

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION!,
});

// JWT verifier for access tokens
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.AWS_COGNITO_CLIENT_ID!,
});

// JWT verifier for ID tokens
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.AWS_COGNITO_CLIENT_ID!,
});

export interface CognitoAuthResult {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  cognitoUserId: string;
  email: string;
  name?: string;
}

export interface CognitoUser {
  cognitoUserId: string;
  email: string;
  name?: string; // Legacy full name field
  firstName?: string;
  lastName?: string;
  organization?: string; // Business name
  phoneNumber?: string;
  emailVerified: boolean;
  enabled: boolean;
  attributes: Record<string, string>;
}

export class CognitoAuthService {
  /**
   * Authenticate user with email and password
   * For users created with AdminCreateUser, we need to use the stored username
   */
  async signIn(email: string, password: string, cognitoUsername?: string): Promise<CognitoAuthResult> {
    try {
      // Use the provided username, or fall back to email for legacy users
      const usernameForAuth = cognitoUsername || email;
      
      logger.info('Attempting Cognito authentication', { 
        email, 
        usernameForAuth: usernameForAuth === email ? 'email' : 'generated' 
      });

      // Use AdminInitiateAuth for users created with AdminCreateUser
      const adminCommand = new AdminInitiateAuthCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: usernameForAuth, // Use the correct username for auth
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(adminCommand);

      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

      if (!AccessToken || !IdToken || !RefreshToken) {
        throw new Error('Missing tokens in authentication response');
      }

      // Verify and decode ID token to get user info
      const decodedIdToken = await idTokenVerifier.verify(IdToken);
      
      return {
        accessToken: AccessToken,
        idToken: IdToken,
        refreshToken: RefreshToken,
        cognitoUserId: decodedIdToken.sub,
        email: decodedIdToken.email as string,
        name: decodedIdToken.name as string,
      };
    } catch (error: any) {
      logger.error('Cognito sign in error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });
      
      // Map Cognito errors to user-friendly messages
      if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password');
      } else if (error.name === 'UserNotConfirmedException') {
        throw new Error('Email not verified. Please check your email for verification instructions.');
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('Invalid email or password');
      } else if (error.name === 'PasswordResetRequiredException') {
        throw new Error('Password reset required. Please reset your password to continue.');
      } else if (error.name === 'UserNotConfirmedException') {
        throw new Error('Account not verified. Please check your email.');
      }
      
      throw new Error('Authentication failed. Please try again.');
    }
  }

  /**
   * Helper function to generate a unique username from email
   */
  private generateUsername(email: string): string {
    // Generate a completely random username to avoid any email-like patterns
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const randomPart = Math.random().toString(36).substring(2, 10); // Random 8 chars
    return `u${timestamp}${randomPart}`.toLowerCase(); // Simple format: u + timestamp + random
  }

  /**
   * Register a new user using AdminCreateUser to prevent automatic emails
   * Store username in our database for later authentication
   */
  async signUp(email: string, password: string, firstName?: string, lastName?: string, businessName?: string, phoneNumber?: string): Promise<{ cognitoUserId: string; cognitoUsername: string; needsVerification: boolean }> {
    try {
      const attributes: AttributeType[] = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'false' }, // Start unverified
      ];

      // Add custom attributes to match your Cognito setup
      if (firstName) {
        attributes.push({ Name: 'custom:firstName', Value: firstName });
      }
      if (lastName) {
        attributes.push({ Name: 'custom:lastName', Value: lastName });
      }
      if (businessName) {
        attributes.push({ Name: 'custom:organization', Value: businessName });
      }
      if (phoneNumber) {
        attributes.push({ Name: 'custom:phone_number', Value: phoneNumber });
      }

      // Also set the legacy 'name' field for backward compatibility
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (fullName) {
        attributes.push({ Name: 'name', Value: fullName });
      }

      // Generate a unique username from the email
      const username = this.generateUsername(email);

      // Use AdminCreateUser instead of SignUp to prevent automatic verification emails
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: username,
        UserAttributes: attributes,
        MessageAction: MessageActionType.SUPPRESS, // CRITICAL: This prevents AWS from sending emails
        TemporaryPassword: 'TempPass123!', // Will be overwritten immediately
      });

      const createResponse = await cognitoClient.send(createUserCommand);

      // Immediately set the permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: username,
        Password: password,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      // Get the actual Cognito User ID from the response
      const cognitoUserId = createResponse.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value 
        || createResponse.User?.Username!;

      logger.info('Cognito user created successfully', { 
        email, 
        username, 
        cognitoUserId 
      });

      return {
        cognitoUserId,
        cognitoUsername: username, // Return the username for storage
        needsVerification: true, // We always need our custom verification
      };
    } catch (error: any) {
      logger.error('Cognito sign up error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'UsernameExistsException') {
        throw new Error('An account with this email already exists');
      } else if (error.name === 'InvalidPasswordException') {
        throw new Error('Password does not meet requirements');
      } else if (error.name === 'InvalidParameterException') {
        throw new Error('Please check your input and try again');
      }
      
      throw new Error('Registration failed. Please try again.');
    }
  }

  /**
   * Verify user email with confirmation code
   * Note: We need to use email for confirmation since that's what users have
   */
  async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        Username: email, // Use email - Cognito should handle this with email aliases
        ConfirmationCode: confirmationCode,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Cognito confirm sign up error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Verification code has expired');
      }
      
      throw new Error('Email verification failed. Please try again.');
    }
  }

  /**
   * Admin confirm sign up - used for users created with AdminCreateUser
   * This properly sets the user status to CONFIRMED in Cognito
   */
  async adminConfirmSignUp(email: string): Promise<void> {
    try {
      // For AdminCreateUser users, we need to use AdminConfirmSignUpCommand
      // This sets the user status to CONFIRMED which allows password authentication
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: email, // Use email as identifier
      });

      await cognitoClient.send(confirmCommand);

      // Also ensure email is marked as verified
      const updateAttributesCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: email,
        UserAttributes: [
          {
            Name: 'email_verified',
            Value: 'true'
          }
        ]
      });

      await cognitoClient.send(updateAttributesCommand);

      logger.info('User confirmed and verified via admin API', { email });
    } catch (error: any) {
      logger.error('Admin confirm sign up error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });
      
      throw new Error('Admin confirmation failed');
    }
  }

  /**
   * Resend confirmation code for email verification
   */
  async resendConfirmationCode(email: string): Promise<void> {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        Username: email,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Cognito resend confirmation code error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'UserNotFoundException') {
        throw new Error('User not found');
      } else if (error.name === 'InvalidParameterException') {
        throw new Error('User is already confirmed');
      }
      
      throw new Error('Failed to resend confirmation code. Please try again.');
    }
  }

  /**
   * Initiate password reset
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        Username: email,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Cognito forgot password error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'UserNotFoundException') {
        // Don't reveal that user doesn't exist for security
        return;
      }
      
      throw new Error('Password reset request failed. Please try again.');
    }
  }

  /**
   * Confirm password reset with code
   */
  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Cognito confirm forgot password error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid reset code');
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Reset code has expired');
      } else if (error.name === 'InvalidPasswordException') {
        throw new Error('Password does not meet requirements');
      }
      
      throw new Error('Password reset failed. Please try again.');
    }
  }

  /**
   * Verify JWT access token
   */
  async verifyAccessToken(token: string): Promise<any> {
    try {
      const payload = await accessTokenVerifier.verify(token);
      return payload;
    } catch (error: any) {
      logger.error('Access token verification failed', { 
        errorMessage: error.message,
        errorCode: error.name 
      });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Verify JWT ID token
   */
  async verifyIdToken(token: string): Promise<any> {
    try {
      const payload = await idTokenVerifier.verify(token);
      return payload;
    } catch (error: any) {
      logger.error('ID token verification failed', { 
        errorMessage: error.message,
        errorCode: error.name 
      });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user info from Cognito
   */
  async getUser(cognitoUserId: string): Promise<CognitoUser | null> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: cognitoUserId,
      });

      const response = await cognitoClient.send(command);

      const attributes: Record<string, string> = {};
      response.UserAttributes?.forEach(attr => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });

      return {
        cognitoUserId: response.Username!,
        email: attributes.email,
        name: attributes.name, // Legacy full name
        firstName: attributes['custom:firstName'],
        lastName: attributes['custom:lastName'],
        organization: attributes['custom:organization'],
        phoneNumber: attributes['custom:phone_number'],
        emailVerified: attributes.email_verified === 'true',
        enabled: response.Enabled ?? true,
        attributes,
      };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        return null;
      }
      
      logger.error('Get user error', { 
        cognitoUserId, 
        errorMessage: error.message,
        errorCode: error.name 
      });
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Create user in Cognito (for migration)
   */
  async createUser(email: string, temporaryPassword: string, attributes: Record<string, string> = {}): Promise<string> {
    try {
      const userAttributes: AttributeType[] = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }, // Skip email verification for migrated users
      ];

      // Add additional attributes
      Object.entries(attributes).forEach(([key, value]) => {
        if (key !== 'email' && value) {
          userAttributes.push({ Name: key, Value: value });
        }
      });

      const command = new AdminCreateUserCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: email,
        UserAttributes: userAttributes,
        TemporaryPassword: temporaryPassword,
        MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email
      });

      const response = await cognitoClient.send(command);
      return response.User!.Username!;
    } catch (error: any) {
      logger.error('Create user error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });

      if (error.name === 'UsernameExistsException') {
        throw new Error('User already exists in Cognito');
      }
      
      throw new Error('Failed to create user in Cognito');
    }
  }

  /**
   * Set permanent password for migrated user
   */
  async setUserPassword(cognitoUserId: string, password: string): Promise<void> {
    try {
      const command = new AdminSetUserPasswordCommand({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
        Username: cognitoUserId,
        Password: password,
        Permanent: true,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Set user password error', { 
        cognitoUserId, 
        errorMessage: error.message,
        errorCode: error.name 
      });
      throw new Error('Failed to set user password');
    }
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(email: string): Promise<void> {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.AWS_COGNITO_CLIENT_ID!,
        Username: email,
      });

      await cognitoClient.send(command);
    } catch (error: any) {
      logger.error('Resend confirmation code error', { 
        email, 
        errorMessage: error.message,
        errorCode: error.name 
      });
      throw new Error('Failed to resend confirmation code');
    }
  }
}

// Export singleton instance
export const cognitoAuth = new CognitoAuthService();