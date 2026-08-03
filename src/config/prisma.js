import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg({ pool });

const prisma = new PrismaClient({
    adapter,
    log:
        process.env.NODE_ENV === "development"
            ? ["warn", "error", "logs", "query", "info"]
            : ["error"],
});

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("Database connected");
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

const disconnectDB = async () => {
    try {
        await prisma.$disconnect();
        console.log("Disconnected from the database");
    } catch (error) {
        console.error("Error disconnecting from the database:", error);
    }
};

export { connectDB, disconnectDB, prisma };