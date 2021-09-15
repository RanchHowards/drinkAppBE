const express = require('express')
const { ApolloServer, gql } = require('apollo-server-express')

// const { graphqlHTTP } = require('express-graphql')
// const { buildSchema } = require('graphql')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const bcrypt = require('bcrypt')
const saltRounds = 10
const jwt = require('jsonwebtoken')

const User = require('./models/user')
const Event = require('./models/event')
const { UserInputError, AuthenticationError } = require('apollo-server')

const app = express()

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
const typeDefs = gql`
  type User {
    username: String!
    passwordHash: String
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    eventCount: Int!
    allEvents: [Event]
    allUsers: [User]
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
    createUser(username: String!, password: String!): Token
    login(username: String!, password: String!): Token
  }
`

const resolvers = {
  Query: {
    eventCount: () => Event.collection.countDocuments(),
    allEvents: async () => {
      return await Event.find({}).populate('host')
    },
    allUsers: async () => {
      return await User.find({})
    },
    me: (root, args, { currentUser }) => {
      return currentUser
    },
  },

  Mutation: {
    addEvent: async (root, args, context) => {
      const { currentUser } = context
      if (!currentUser) {
        throw new AuthenticationError('NOT AUthorIZED, bub!!!')
      }
      const event = new Event({
        title: args.title,
        host: currentUser._id,
      })
      try {
        await event.save()
      } catch (error) {
        throw new Error(error.message)
      }
      return event
    },

    createUser: async (root, { username, password }) => {
      try {
        const salt = await bcrypt.genSalt(saltRounds)
        const passwordHash = await bcrypt.hash(password, salt)
        const user = new User({ username, passwordHash })
        await user.save()

        const userForToken = {
          username: user.username,
          id: user._id,
        }
        return { value: jwt.sign(userForToken, JWT_SECRET) }
      } catch (error) {
        throw new UserInputError(error.message)
      }
    },
    login: async (root, { username, password }) => {
      const user = await User.findOne({ username })
      const passwordCorrect =
        user === null
          ? false
          : await bcrypt.compare(password, user.passwordHash)

      if (!(user && passwordCorrect)) {
        throw new UserInputError('wrong password or Username')
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      }
      return { value: jwt.sign(userForToken, JWT_SECRET) }
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null

    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET)
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  },
})

server.start().then((res) => {
  server.applyMiddleware({ app })
})
app.use(cors())

const PORT = 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
