require('dotenv').config();
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb } = require("./src/utils/dynamodb");

const IMAGES_TABLE = process.env.DYNAMODB_IMAGES_TABLE || "ai-bharat-images";

const FISH_SPECIES = ["Indian Pomfret", "Kingfish", "Yellowfin Tuna", "Mackerel", "Sardine", "Bombay Duck", "Prawns"];
const GRADES = ["Premium", "Standard", "Low"];

function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

const dummyPoints = Array.from({ length: 25 }).map((_, idx) => ({
    imageId: `dummy-img-${Date.now()}-${idx}`,
    userId: "dummy-user-123",
    status: "completed",
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: getRandomInRange(11.0, 19.5), // West coast of India roughly
    longitude: getRandomInRange(71.0, 73.5),
    analysisResult: {
        species: FISH_SPECIES[Math.floor(Math.random() * FISH_SPECIES.length)],
        qualityGrade: GRADES[Math.floor(Math.random() * GRADES.length)],
        measurements: {
            weight_g: Math.floor(getRandomInRange(500, 15000))
        },
        confidence: parseFloat(getRandomInRange(0.8, 0.99).toFixed(2))
    }
}));

async function seed() {
    console.log("Seeding dummy points to:", IMAGES_TABLE);
    let count = 0;
    for (const point of dummyPoints) {
        await ddb.send(new PutCommand({
            TableName: IMAGES_TABLE,
            Item: point
        }));
        count++;
    }
    console.log(`Successfully seeded ${count} dummy points.`);
}

seed().catch(console.error);
