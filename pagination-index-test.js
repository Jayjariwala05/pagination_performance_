
const { MongoClient } = require("mongodb");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";

async function main() {
    const client = new MongoClient(URI, {
        serverSelectionTimeoutMS: 3000
    });

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const members = db.collection("benchmark_members");

        console.log("Before index:");

        const before = await members.find({})
            .sort({ memberId: 1 })
            .skip(9990)
            .limit(10)
            .explain("executionStats");

        console.log(JSON.stringify({
            executionTimeMillis:
                before.executionStats.executionTimeMillis,
            nReturned: before.executionStats.nReturned,
            totalKeysExamined:
                before.executionStats.totalKeysExamined,
            totalDocsExamined:
                before.executionStats.totalDocsExamined,
            winningPlan: before.queryPlanner.winningPlan
        }, null, 2));

        // Add an index to the local synthetic-data collection.
        await members.createIndex({ memberId: 1 });

        console.log("\nAfter index:");

        const after = await members.find({})
            .sort({ memberId: 1 })
            .skip(9990)
            .limit(10)
            .explain("executionStats");

        console.log(JSON.stringify({
            executionTimeMillis:
                after.executionStats.executionTimeMillis,
            nReturned: after.executionStats.nReturned,
            totalKeysExamined:
                after.executionStats.totalKeysExamined,
            totalDocsExamined:
                after.executionStats.totalDocsExamined,
            winningPlan: after.queryPlanner.winningPlan
        }, null, 2));

    } catch (error) {
        console.error("Index experiment failed:", error.message);
    } finally {
        await client.close();
    }
}

main();