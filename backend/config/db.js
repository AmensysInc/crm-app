import mongoose from "mongoose";

/**
 * Establish a connection to MongoDB.
 * The connection string is read from the MONGO_URI environment variable.
 * We keep this isolated so the rest of the app never touches the driver directly.
 */
export const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  // Avoid deprecation noise & make queries fail fast instead of buffering forever.
  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};
