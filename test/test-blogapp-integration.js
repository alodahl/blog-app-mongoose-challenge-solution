const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function seedBlogData() {
  console.info('seeding Blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
function generateBlogData() {
  return {
    author: faker.Name.findName(),
    title: faker.Lorem.sentence(),
    content: faker.Lorem.paragraph(),
    created: faker.date.past()
  }
}

function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Blog API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  })

  describe('GET endpoint', function() {

      it('should return all blog entries', function() {
        // strategy:
        //    1. get back all blog entries returned by by GET request to `/posts`
        //    2. prove res has right status, data type
        //    3. prove the number of entries we got back is equal to number
        //       in db.
        let res;
        return chai.request(app)
          .get('/posts')
          .then(function(_res) {
            // so subsequent .then blocks can access resp obj.
            res = _res;
            res.should.have.status(200);
            // otherwise our db seeding didn't work
            res.body.BlogPosts.should.have.length.of.at.least(1);
            return BlogPost.count();
          })
          .then(function(count) {
            res.body.BlogPosts.should.have.length.of(count);
        });
      });

      it('should return entries with right fields', function() {
      // Strategy: Get back all entries, and ensure they have expected keys

      let resBlogPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.BlogPosts.should.be.a('array');
          res.body.BlogPosts.should.have.length.of.at.least(1);

          res.body.restaurants.forEach(function(restaurant) {
            BlogPost.should.be.a('object');
            BlogPost.should.include.keys(
              'id', 'author', 'title', 'content', 'created');
          });
          resBlogPost = res.body.BlogPost[0];
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function(BlogPost) {

          resBlogPost.id.should.equal(BlogPost.id);
          resBlogPost.author.should.equal(BlogPost.author);
          resBlogPost.title.should.equal(BlogPost.title);
          resBlogPost.content.should.equal(BlogPost.content);
          resBlogPost.created.should.equal(BlogPost.created);

        });
    });
    });
});
