
const { MongoClient } = require("mongodb");

const LOCAL_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "membroz_pagination_test";

async function main() {
    const client = new MongoClient(LOCAL_URI);

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const members = db.collection("members");

        const filter = { branchId: "BR001" };
        const pageSize = 10;

        const totalCount = await members.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSize);

        console.log("Total matching records:", totalCount);
        console.log("Total pages:", totalPages);

        const allSeenIds = [];

        for (let page = 1; page <= totalPages; page++) {
            const records = await members
                .find(filter)
                .sort({ memberId: 1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray();

            const ids = records.map(member => member.memberId);
            allSeenIds.push(...ids);

            console.log(`Page ${page}:`, ids);
        }

        const uniqueIds = new Set(allSeenIds);

        console.log("Records retrieved:", allSeenIds.length);
        console.log("Unique records:", uniqueIds.size);
        console.log(
            "Duplicates found:",
            allSeenIds.length - uniqueIds.size
        );
        console.log(
            "Pagination complete:",
            allSeenIds.length === totalCount &&
            uniqueIds.size === totalCount
        );
    } catch (error) {
        console.error("Experiment failed:", error.message);
    } finally {
        await client.close();
    }
}

main();
