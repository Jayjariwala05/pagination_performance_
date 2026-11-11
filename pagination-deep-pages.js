
const { MongoClient } = require("mongodb");
const { performance } = require("node:perf_hooks");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";
const PAGE_SIZE = 10;
const RUNS = 10;

async function main() {
    const client = new MongoClient(URI, {
        serverSelectionTimeoutMS: 3000
    });

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const members = db.collection("benchmark_members");

        const total = await members.countDocuments({});
        console.log("Dataset records:", total);
        console.log("Page size:", PAGE_SIZE);
        console.log("Times are milliseconds (ms).\n");

        const pages = [1, 100, 1000];

        for (const page of pages) {
            const skip = (page - 1) * PAGE_SIZE;

            if (skip >= total) {
                console.log(`Page ${page}: unavailable for this dataset`);
                continue;
            }

            const query = () => members
                .find({})
                .sort({ memberId: 1 })
                .skip(skip)
                .limit(PAGE_SIZE)
                .toArray();

            // Warm up the query.
            await query();

            const times = [];

            for (let i = 0; i < RUNS; i++) {
                const start = performance.now();
                const records = await query();
                times.push(performance.now() - start);

                if (records.length !== PAGE_SIZE) {
                    throw new Error(
                        `Page ${page} returned ${records.length} records`
                    );
                }
            }

            times.sort((a, b) => a - b);
            const median = (times[4] + times[5]) / 2;

            console.log(`Page ${page}:`);
            console.log(`  Skip value: ${skip}`);
            console.log(`  Records returned: ${PAGE_SIZE}`);
            console.log(`  Median time: ${median.toFixed(3)} ms`);
            console.log("-----------------------------");
        }
    } catch (error) {
        console.error("Experiment failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
