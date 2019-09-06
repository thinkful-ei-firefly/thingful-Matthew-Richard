/* eslint-disable quotes */
'use strict';

const bcrypt = require('bcryptjs');
const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe.only('Users Endpoints', function () {
    let db;

    const { testUsers } = helpers.makeThingsFixtures();
    const testUser = testUsers[0];

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

    describe(`POST /api/users`, () => {

        context(`Happy path`, () => {
            it(`responds 201, serialized user, storing bcryped password`, () => {
                const newUser = {
                    user_name: 'test user_name',
                    password: '11AAaa!!',
                    full_name: 'test full_name',
                };
                return supertest(app)
                    .post('/api/users')
                    .send(newUser)
                    .expect(201)
                    .expect(res =>
                        db
                            .from('thingful_users')
                            .select('*')
                            .where({ id: res.body.id })
                            .first()
                            .then(row => {
                                expect(row.user_name).to.eql(newUser.user_name);
                                expect(row.full_name).to.eql(newUser.full_name);
                                expect(row.nickname).to.eql(null);
                                const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' });
                                const actualDate = new Date(row.date_created).toLocaleString();
                                expect(actualDate).to.eql(expectedDate);

                                return bcrypt.compare(newUser.password, row.password);

                            })
                            .then(compareMatch => {
                                expect(compareMatch).to.be.true;
                            })
                    );
            });
        }),

        context(`User Validation`, () => {
            beforeEach('insert users', () =>
                helpers.seedUsers(
                    db,
                    testUsers
                )
            );

            const requiredFields = ['user_name', 'password', 'full_name'];

            requiredFields.forEach(field => {
                const registerAttemptBody = {
                    user_name: 'test user_name',
                    password: 'test password',
                    full_name: 'test full_name',
                    nickname: 'test nickname'
                };

                it(`responds with 400 required error when '${field}' is missing`, () => {
                    delete registerAttemptBody[field];

                    return supertest(app)
                        .post('/api/users')
                        .send(registerAttemptBody)
                        .expect(400, {
                            error: `Missing '${field}' in request body`,
                        });
                });
            });

            it(`responds 400 'Password must be longer than 8 characters'`, () => {
                const userShortPassword = {
                    user_name: 'test user_name',
                    password: '1234567',
                    full_name: 'test full_name'
                };
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, { error: 'Password must be longer than 8 characters' });
            });

            it(`responds 400 'Password must be less than 72 characters'`, () => {
                const userShortPassword = {
                    user_name: 'test user_name',
                    password: '*'.repeat(73),
                    full_name: 'test full_name'
                };
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, { error: 'Password must be less than 72 characters' });
            });

            it(`responds 400 'Password must not start with empty spaces'`, () => {
                const userShortPassword = {
                    user_name: 'test user_name',
                    password: ' 1 2 3 4 5 6 7',
                    full_name: 'test full_name'
                };
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, { error: 'Password must not start or end with empty spaces' });
            });

            it(`responds 400 'Password must not end with empty spaces'`, () => {
                const userShortPassword = {
                    user_name: 'test user_name',
                    password: '1 2 3 4 5 6 7 ',
                    full_name: 'test full_name'
                };
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, { error: 'Password must not start or end with empty spaces' });
            });

            it(`responds 400 error when password isn't complex enough`, () => {
                const userPasswordNotComplex = {
                    user_name: 'test user_name',
                    password: '11AAaabb',
                    full_name: 'test full_name'
                };
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordNotComplex)
                    .expect(400, { error: `Password must contain 1 upper case, lower case, number and special character` });
            });

            it(`responds 400 'User name already taken' when user_name isn't unique`, () => {
                const duplicateUser = {
                    user_name: testUser.user_name,
                    password: '11AAaa!!',
                    full_name: 'test full_name',
                };
                return supertest(app)
                    .post('/api/users')
                    .send(duplicateUser)
                    .expect(400, { error: `Username already taken` });
            });

        });
    });
});