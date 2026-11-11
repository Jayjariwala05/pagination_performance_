
const { MongoClient } = require("mongodb");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";
const PAGE_SIZE = 10;
const PAGE = 1000;

async function main() {
    const client = new MongoClient(URI, {
        serverSelectionTimeoutMS: 3000
    });

    try {
        await client.connect();

        const members = client
            .db(DB_NAME)
            .collection("benchmark_members");

        const total = await members.countDocuments({});

        if (total < PAGE * PAGE_SIZE) {
            throw new Error(`Expected at least ${PAGE * PAGE_SIZE} records.`);
        }

        await members.createIndex({ memberId: 1 });

        const offset = await members.find({})
            .sort({ memberId: 1 })
            .skip((PAGE - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .explain("executionStats");

        const previous = await members.find({})
            .sort({ memberId: 1 })
            .skip((PAGE - 1) * PAGE_SIZE - 1)
            .limit(1)
            .toArray();

        const lastId = previous[0].memberId;

        const cursor = await members.find({
            memberId: { $gt: lastId }
        })
            .sort({ memberId: 1 })
            .limit(PAGE_SIZE)
            .explain("executionStats");

        function summarize(plan) {
            return {
                returned: plan.executionStats.nReturned,
                keysExamined: plan.executionStats.totalKeysExamined,
                docsExamined: plan.executionStats.totalDocsExamined,
                executionTimeMillis:
                    plan.executionStats.executionTimeMillis,
                winningPlan: plan.queryPlanner.winningPlan
            };
        }

        console.log("Dataset records:", total);
        console.log("Offset pagination:");
        console.log(JSON.stringify(summarize(offset), null, 2));

        console.log("\nCursor pagination:");
        console.log(JSON.stringify(summarize(cursor), null, 2));
    } catch (error) {
        console.error("Validation failed:", error.message);
    } finally {
        await client.close();
    }
}

main(); 