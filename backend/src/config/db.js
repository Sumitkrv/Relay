import mongoose from 'mongoose';

export default async function connectDB(customUri = null, options = {}) {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freelance_automation_crm';

  // Support isolated demo database selection without mutating .env files
  const dbName = process.env.DATABASE_NAME || (process.env.APP_MODE === 'demo' ? 'relay_demo' : undefined);

  const connectOptions = {
    serverSelectionTimeoutMS: 8000,
    ...options,
  };
  if (dbName) {
    connectOptions.dbName = dbName;
  }

  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  await mongoose.connect(uri, connectOptions);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.db?.databaseName || dbName || ''}`);
}
