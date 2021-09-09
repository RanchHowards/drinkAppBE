const express = require('express')
const app = express()
const { graphqlHTTP } = require('express-graphql')
const { buildSchema } = require('graphql')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const User = require('./models/user')
const Event = require('./models/event')

//MONGOOSE
const JWT_SECRET = process.env.SECRET

const MONGODB_URI = process.env.MONGODB

console.log('connecting to', MONGODB_URI)

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
type User {
    username: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    eventCount: Int!
    allEvents: [Event]
    allUsers: User
    me: User
  }
  type Event {
    title: String
    host: User
    attendees: [String]
    id: ID!
  }
  type Mutation {
    addEvent(title: String): Event
    createUser(username: String!): User
  }
`)

// The root provides a resolver function for each API endpoint
var root = {
  eventCount: () => Event.collection.countDocuments(),
  allEvents: async () => {
    return await Event.find({}).populate('host')
  },
  allUsers: () => User.find({}),
  me: (root, args, context) => {
    return context.currentUser
  },

  addEvent: async ({ title }) => {
    const event = new Event({
      title,
      host: '6138d82ccd2c5d2a5ee03038',
    })
    try {
      await event.save()
    } catch (error) {
      throw new Error(error.message)
    }

    return event
  },

  createUser: async (root, args) => {
    try {
      const user = new User({ ...args })
      await user.save()
      return user
    } catch (error) {
      throw new UserInputError(error.message, { invalidArgs: args })
    }
  },
}

app.use(cors())

app.use(
  '/',
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: false,
  })
)

const PORT = 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
