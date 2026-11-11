
const { MongoClient } = require("mongodb");
const { performance } = require("node:perf_hooks");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";
const PAGE_SIZE = 10;
const RUNS = 10;
const DEEP_PAGE = 1000;

async function medianTime(queryFunction) {
    const times = [];

    for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        await queryFunction();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    return (times[4] + times[5]) / 2;
}

async function main() {
    const client = new MongoClient(URI, {
        serverSelectionTimeoutMS: 3000
    });

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const members = db.collection("benchmark_members");

        const total = await members.countDocuments({});
        const skipCount = (DEEP_PAGE - 1) * PAGE_SIZE;

        if (total < DEEP_PAGE * PAGE_SIZE) {
            throw new Error(
                `Need at least ${DEEP_PAGE * PAGE_SIZE} records; found ${total}`
            );
        }

        // Ensure both methods can use the same indexed sort key.
        await members.createIndex({ memberId: 1 });

        // Find the last member ID preceding the target page.
        const previousPage = await members.find({})
            .sort({ memberId: 1 })
            .skip(skipCount - 1)
            .limit(1)
            .toArray();

        const cursorId = previousPage[0].memberId;

        // Offset pagination: page 1,000.
        const offsetQuery = () => members.find({})
            .sort({ memberId: 1 })
            .skip(skipCount)
            .limit(PAGE_SIZE)
            .toArray();

        // Cursor pagination: next 10 IDs after the previous page's last ID.
        const cursorQuery = () => members.find({
            memberId: { $gt: cursorId }
        })
            .sort({ memberId: 1 })
            .limit(PAGE_SIZE)
            .toArray();

        // Warm up both query paths.
        await offsetQuery();
        await cursorQuery();

        const offsetMs = await medianTime(offsetQuery);
        const cursorMs = await medianTime(cursorQuery);

        const offsetRecords = await offsetQuery();
        const cursorRecords = await cursorQuery();

        console.log("Dataset records:", total);
        console.log("Target page:", DEEP_PAGE);
        console.log("Page size:", PAGE_SIZE);
        console.log("Cursor starts after memberId:", cursorId);
        console.log("");

        console.log("Offset pagination:");
        console.log("Median time:", offsetMs.toFixed(3), "ms");
        console.log(
            "Member IDs:",
            offsetRecords.map(member => member.memberId)
        );

        console.log("\nCursor pagination:");
        console.log("Median time:", cursorMs.toFixed(3), "ms");
        console.log(
            "Member IDs:",
            cursorRecords.map(member => member.memberId)
        );

        console.log(
            "\nSame records:",
            JSON.stringify(offsetRecords.map(m => m.memberId)) ===
            JSON.stringify(cursorRecords.map(m => m.memberId))
        );
    } catch (error) {
        console.error("Comparison failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
