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
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraph()
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
            res.body.should.have.length.of.at.least(1);
            return BlogPost.count();
          })
          .then(function(count) {
            res.body.should.have.lengthOf(count);
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
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys(
              'id', 'author', 'title', 'content', 'created');
          });
          resBlogPost = res.body[0];
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function(BlogPost) {

          resBlogPost.id.should.equal(BlogPost.id);
          resBlogPost.author.should.equal(BlogPost.author.firstName+" "+BlogPost.author.lastName);
          resBlogPost.title.should.equal(BlogPost.title);
          resBlogPost.content.should.equal(BlogPost.content);
        });
      });
    });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the blog post we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
      it('should add a new post', function() {

        const newPost = generateBlogData();
        let mostRecentPost;

        return chai.request(app)
          .post('/posts')
          .send(newPost)
          .then(function(res) {
            res.should.have.status(201);
            res.should.be.json;
            res.body.should.be.a('object');
            res.body.should.include.keys(
              'id', 'author', 'title', 'content', 'created');
            res.body.author.should.equal(newPost.author.firstName+" "+newPost.author.lastName);

            // because Mongo should have created id on insertion
            res.body.id.should.not.be.null;
            res.body.title.should.equal(newPost.title);
            res.body.content.should.equal(newPost.content);
            return BlogPost.findById(res.body.id);
          })
          .then(function(BlogPost) {
            BlogPost.author.firstName.should.equal(newPost.author.firstName);
            BlogPost.author.lastName.should.equal(newPost.author.lastName);
            // BlogPost.author.should.equal(newPost.author.firstName+" "+newPost.author.lastName);
            BlogPost.title.should.equal(newPost.title);
            BlogPost.content.should.equal(newPost.content);
          });
      });
  });

  describe('PUT endpoint', function() {
    // strategy:
    //  1. Get an existing post from db
    //  2. Make a PUT request to update that post
    //  3. Prove post returned by request contains data we sent
    //  4. Prove post in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'futuristic landscape'
      };

      return BlogPost
        .findOne()
        .then(function(blogpost) {
          updateData.id = blogpost.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blogpost.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(blogpost) {
          blogpost.title.should.equal(updateData.title);
          blogpost.content.should.equal(updateData.content);
        });
      });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a blog post
    //  2. make a DELETE request for that post's id
    //  3. assert that response has right status code
    //  4. prove that post with the id doesn't exist in db anymore
    it('deletes a blog post by id', function() {

      let blogpost;

      return BlogPost
        .findOne()
        .then(function(_blogpost) {
          blogpost = _blogpost;
          return chai.request(app).delete(`/posts/${blogpost.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(blogpost.id);
        })
        .then(function(_blogpost) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blogpost);
        });
    });
  });
});
