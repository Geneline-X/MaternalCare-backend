import passport from 'passport';
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth2';
import User from '../models/User.js';

export default function initializePassport() {
  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth 2.0 Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (request, accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user in your database
          let user = await User.findOne({ email: profile.email });

          if (!user) {
            // Create a new user
            user = new User({
              googleId: profile.id,
              email: profile.email,
              name: profile.displayName,
              picture: profile.picture || null,
              role: 'patient', // Default role
              facilityId: null,
            });
            await user.save();
          } else if (!user.googleId) {
            // Update existing user with Google ID if not set
            user.googleId = profile.id;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  // Initialize passport
  return passport.initialize();
}

// Export the configured passport instance
export const configuredPassport = initializePassport();
