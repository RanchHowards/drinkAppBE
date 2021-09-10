const express = require('express')
const app = express()
const { graphqlHTTP } = require('express-graphql')
const { buildSchema } = require('graphql')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const bcrypt = require('bcrypt')
const saltRounds = 10
const jwt = require('jsonwebtoken')

const User = require('./models/user')
const Event = require('./models/event')
const { UserInputError } = require('apollo-server')

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
    createUser(username: String! password: String!): User
    login(username: String! password: String!): Token
  }
`)

// The root provides a resolver function for each API endpoint
var root = {
  // don't have to separate by QUERY, MUTATION, etc. in Express version

  //QUERIES
  eventCount: () => Event.collection.countDocuments(),
  allEvents: async () => {
    return await Event.find({}).populate('host')
  },
  allUsers: () => User.find({}),
  me: ({ currentUser }) => {
    //LEFT OFF TRYING TO GET THIS TO WORK
    return currentUser
  },

  //MUTATIONS
  addEvent: async ({ title }) => {
    //difference in the arguments when using Express
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

  createUser: async ({ username, password }) => {
    try {
      const salt = await bcrypt.genSalt(saltRounds)
      const passwordHash = await bcrypt.hash(password, salt)
      const user = new User({ username, passwordHash })
      await user.save()
      return user
    } catch (error) {
      throw new UserInputError(error.message)
    }
  },
  login: async ({ username, password }) => {
    const user = await User.findOne({ username })
    const passwordCorrect =
      user === null ? false : await bcrypt.compare(password, user.passwordHash)

    if (!(user && passwordCorrect)) {
      throw new UserInputError('wrong password or Username')
    }

    const userForToken = {
      username: user.username,
      id: user._id,
    }

    return { value: jwt.sign(userForToken, JWT_SECRET) }
  },
}

app.use(cors())

app.use(
  '/',
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
    context: async ({ req }) => {
      const auth = req ? req.headers.authorization : null

      if (auth && auth.toLowerCase().startsWith('bearer ')) {
        const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET)
        const currentUser = await User.findById(decodedToken.id)
        return { currentUser }
      }
    },
  })
)

const PORT = 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
