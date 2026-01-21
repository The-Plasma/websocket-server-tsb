const request = require('supertest');
const app = require('../src/index'); // Adjust the path as necessary to import your app

describe('API Tests', () => {
    it('should respond with a 200 status for the root endpoint', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
    });

    // Add more tests for your routes and controllers here
});