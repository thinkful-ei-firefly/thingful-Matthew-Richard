'use strict';

const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Protected endpoints', function() {
    let db;

    const {
        testUsers,
        testThings,
        testReviews
    } = helpers.makeThingsFixtures();

    function makeAuthHeader(user) {
        const token = Buffer.from(`${user.user_name}:${user.password}`).toString('base64');
        return `Basic ${token}`;
    }

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
            path: '/api/things/1'
        },
        {
            name: 'GET /api/things/:thing_id',
            path: '/api/things/1/reviews'
        },
    ];

    protectedEndpoints.forEach(endpoint => {
        describe(endpoint.name, () => {

            // eslint-disable-next-line quotes
            it(`responds with 401 'Missing basic token' when no basic token`, () => {
                return supertest(app)
                    .get(endpoint.path)
                    .expect(401, { error: 'Missing basic token.' });
            });

            // eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when no credentials in token`, () => {
                const userNoCreds = { username: '', password: '' };
                return supertest(app)
                    .get(endpoint.path)
                    .set('Authorization', makeAuthHeader(userNoCreds))
                    .expect(401, { error: 'Unauthorized request' });
            });

            // eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when invalid user`, () => {
                const userInvalidCreds = { user_name: 'nouser', password: 'nopass' };
                return supertest(app)
                    .get(endpoint.path)
                    .set('Authorization', makeAuthHeader(userInvalidCreds))
                    .expect(401, { error: 'Unauthorized request' });
            });

            //eslint-disable-next-line quotes
            it(`responds 401 'Unauthorized request' when invalid password`, () => {
                const userInvalidPass = { user_name: testUsers[0].user_name, password: 'wrongpass' };
                return supertest(app)
                    .get(endpoint.path)
                    .set('Authorization', makeAuthHeader(userInvalidPass))
                    .expect(401, { error: 'Unauthorized request' });
            });

        });
    });
});