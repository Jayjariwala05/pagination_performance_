
const { MongoClient } = require("mongodb");
const { performance } = require("node:perf_hooks");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";
const PAGE_SIZE = 10;
const RUNS = 10;
const PAGES = [1, 100, 1000];

async function medianTime(fn) {
    const times = [];

    for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    return (times[4] + times[5]) / 2;
}

async function getStats(collection, filter, skip) {
    const plan = await collection.find(filter)
        .sort({ memberId: 1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .explain("executionStats");

    return {
        returned: plan.executionStats.nReturned,
        keysExamined: plan.executionStats.totalKeysExamined,
        docsExamined: plan.executionStats.totalDocsExamined
    };
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
        if (total < 100000) {
            throw new Error(`Expected 100,000 records; found ${total}`);
        }

        await members.createIndex({ memberId: 1 });

        console.log("Dataset:", total, "synthetic records");
        console.log("Page size:", PAGE_SIZE);
        console.log("Runs per method:", RUNS);
        console.log("Times are median milliseconds.\n");

        for (const page of PAGES) {
            const skip = (page - 1) * PAGE_SIZE;

            // Get the last ID before the requested page.
            let cursorId = null;

            if (page > 1) {
                const previous = await members.find({})
                    .sort({ memberId: 1 })
                    .skip(skip - 1)
                    .limit(1)
                    .toArray();

                cursorId = previous[0]?.memberId;
            }

            const offsetQuery = () => members.find({})
                .sort({ memberId: 1 })
                .skip(skip)
                .limit(PAGE_SIZE)
                .toArray();

            const cursorQuery = () => {
                const filter = cursorId === null
                    ? {}
                    : { memberId: { $gt: cursorId } };

                return members.find(filter)
                    .sort({ memberId: 1 })
                    .limit(PAGE_SIZE)
                    .toArray();
            };

            await offsetQuery();
            await cursorQuery();

            const offsetMs = await medianTime(offsetQuery);
            const cursorMs = await medianTime(cursorQuery);

            const offsetStats = await getStats(members, {}, skip);
            const cursorStats = await members.find(
                cursorId === null
                    ? {}
                    : { memberId: { $gt: cursorId } }
            )
                .sort({ memberId: 1 })
                .limit(PAGE_SIZE)
                .explain("executionStats");

            const cursorResult = {
                returned: cursorStats.executionStats.nReturned,
                keysExamined: cursorStats.executionStats.totalKeysExamined,
                docsExamined: cursorStats.executionStats.totalDocsExamined
            };

            const offsetRecords = await offsetQuery();
            const cursorRecords = await cursorQuery();

            const sameRecords =
                JSON.stringify(offsetRecords.map(x => x.memberId)) ===
                JSON.stringify(cursorRecords.map(x => x.memberId));

            console.log(`PAGE ${page}`);
            console.log(
                `Offset: ${offsetMs.toFixed(3)} ms | ` +
                `keys: ${offsetStats.keysExamined} | ` +
                `docs: ${offsetStats.docsExamined}`
            );
            console.log(
                `Cursor: ${cursorMs.toFixed(3)} ms | ` +
                `keys: ${cursorResult.keysExamined} | ` +
                `docs: ${cursorResult.docsExamined}`
            );
            console.log("Same records:", sameRecords);
            console.log("--------------------------------");
        }
    } catch (error) {
        console.error("Comparison failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
