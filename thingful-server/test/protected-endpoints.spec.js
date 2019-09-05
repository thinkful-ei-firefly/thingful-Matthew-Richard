'use strict';

const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe.only('Protected endpoints', function() {
    let db;

    const {
        testUsers,
        testThings,
        testReviews
    } = helpers.makeThingsFixtures();

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        });
        app.set('db', db);
    });

    after('disconnect from db', () => db.destroy());

    before('cleanup', () => helpers.cleanTables(db));

    afterEach('cleanup', () => helpers.cleanTables(db));

    beforeEach('insert articles', () => 
        helpers.seedThingsTables (
            db,
            testUsers,
            testThings,
            testReviews
        )
    );

    const protectedEndpoints = [
        {
            name: 'GET /api/things/:thing_id',
            path: '/api/things/1',
            method: supertest(app).get
        },
        {
            name: 'GET /api/things/:thing_id/reviews',
            path: '/api/things/1/reviews',
            method: supertest(app).get
        },
        {
            name: 'POST /api/reviews',
            path: '/api/reviews',
            method: supertest(app).post
        }
    ];

    protectedEndpoints.forEach(endpoint => {
        describe(endpoint.name, () => {

            // eslint-disable-next-line quotes
            it(`responds with 401 'Missing bearer token' when no bearer token`, () => {
                return endpoint.method(endpoint.path)
                    .expect(401, { error: 'Missing bearer token' });
            });

            // eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when invalid JWT secret`, () => {

                const validUser = testUsers[0];
                const invalidSecret = 'invalid';
                return endpoint.method(endpoint.path)
                    .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
                    .expect(401, { error: 'Unauthorized request' });
            });

            // eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when invalid subject in payload`, () => {
                const invalidUser = { user_name: 'nouser', id: 1 };
                return endpoint.method(endpoint.path)
                    .set('Authorization', helpers.makeAuthHeader(invalidUser))
                    .expect(401, { error: 'Unauthorized request' });
            });

            //eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when invalid password`, () => {
                const userInvalidPass = { user_name: testUsers[0].user_name, password: 'wrongpass' };
                return endpoint.method(endpoint.path)
                    .set('Authorization', helpers.makeAuthHeader(userInvalidPass))
                    .expect(401, { error: 'Unauthorized request' });
            });

        });
    });
});