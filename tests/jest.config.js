
require('dotenv').config({ path: './tests/test.env' });

module.exports = {
    testEnvironment: "node",
    verbose:true,
    "setupFilesAfterEnv": ["jest-expect-message"]
}