
const { MongoClient } = require("mongodb");
const { performance } = require("node:perf_hooks");

const URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";
const SIZES = [1000, 10000, 100000];
const PAGE_SIZE = 10;
const RUNS = 5;

async function measure(fn) {
    const times = [];

    for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    return Number(times[Math.floor(times.length / 2)].toFixed(3));
}

async function main() {
    const client = new MongoClient(URI, {
        serverSelectionTimeoutMS: 3000
    });

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const members = db.collection("benchmark_members");

        console.log("Database:", DB_NAME);
        console.log("Collection: benchmark_members");
        console.log("All data is synthetic.");
        console.log("Times are milliseconds (ms).\n");

        for (const size of SIZES) {
            // Replace only this experiment's dedicated collection.
            await members.deleteMany({});

            const batchSize = 5000;

            for (let start = 0; start < size; start += batchSize) {
                const end = Math.min(start + batchSize, size);
                const batch = [];

                for (let i = start; i < end; i++) {
                    batch.push({
                        memberId: i + 1,
                        name: `Synthetic Member ${i + 1}`,
                        branchId: i % 2 === 0 ? "BR001" : "BR002"
                    });
                }

                await members.insertMany(batch);
            }

            const filter = { branchId: "BR001" };
            const matchingCount = await members.countDocuments(filter);

            // Warm up both query paths before timing.
            await members.find(filter)
                .sort({ memberId: 1 })
                .skip(0)
                .limit(PAGE_SIZE)
                .toArray();

            await members.find(filter)
                .sort({ memberId: 1 })
                .toArray();

            const paginatedMs = await measure(async () => {
                await members.find(filter)
                    .sort({ memberId: 1 })
                    .skip(0)
                    .limit(PAGE_SIZE)
                    .toArray();
            });

            const fullRetrievalMs = await measure(async () => {
                await members.find(filter)
                    .sort({ memberId: 1 })
                    .toArray();
            });

            console.log(`Dataset size: ${size}`);
            console.log(`Matching records: ${matchingCount}`);
            console.log(`Page size: ${PAGE_SIZE}`);
            console.log(`Paginated first-page median: ${paginatedMs} ms`);
            console.log(`Full retrieval median: ${fullRetrievalMs} ms`);
            console.log("--------------------------------");
        }
    } catch (error) {
        console.error("Benchmark failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
