
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

        const plan = await members.find({})
            .sort({ memberId: 1 })
            .skip(9990)
            .limit(10)
            .explain("executionStats");

        console.log(JSON.stringify({
            queryPlanner: {
                winningPlan: plan.queryPlanner.winningPlan
            },
            executionStats: {
                executionTimeMillis:
                    plan.executionStats.executionTimeMillis,
                nReturned: plan.executionStats.nReturned,
                totalKeysExamined:
                    plan.executionStats.totalKeysExamined,
                totalDocsExamined:
                    plan.executionStats.totalDocsExamined
            }
        }, null, 2));
    } catch (error) {
        console.error("Query plan failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
