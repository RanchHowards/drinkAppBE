const {
  ApolloServer,
  gql,
  UserInputError,
  AuthenticationError,
} = require('apollo-server')
const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { PubSub } = require('graphql-subscriptions')
require('dotenv').config()

const User = require('./models/user')
const Event = require('./models/event')

const pubsub = new PubSub()

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

const typeDefs = gql`
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
`
//   type Book {
//     title: String!
//     published: String!
//     author: Author!
//     id: ID!
//     genres: [String!]!
//   }

//   type Mutation {
//     addEvent(title: String!): Event
//     editAuthor(author: String!, setBornTo: String!): Author
//     createUser(username: String!): User
//     login(username: String!, password: String!): Token
//   }
//   type Subscription {
//     bookAdded: Book!
//   }
// `

const resolvers = {
  Query: {
    eventCount: () => Event.collection.countDocuments(),
    allEvents: async () => {
      return await Event.find({}).populate('host')
    },
    allUsers: () => User.find({}),
    me: (root, args, context) => {
      return context.currentUser
    },
  },

  //   Author: {
  //     bookCount: async (root) => {
  //       const books = await Book.find({}).populate('author')
  //       return books.filter((book) => root.name === book.author.name).length
  //     },
  //   },
  //   Book: { author: (root) => Author.findById(root.author) },
  Mutation: {
    addEvent: async (root, args, context) => {
      const event = new Event({
        title: args.title,
        host: '6138d82ccd2c5d2a5ee03038',
      })
      try {
        await event.save()
      } catch (error) {
        throw new UserInputError(error.message, { invalidArgs: args })
      }

      return event
    },
    //   editAuthor: async (root, args, context) => {
    //     const currentUser = context.currentUser
    //     if (!currentUser) {
    //       throw new AuthenticationError('AUTH ERROR in editAuthor!!!')
    //     }
    //     try {
    //       let foundAuthor = await Author.findOneAndUpdate(
    //         { name: args.author },
    //         { born: args.setBornTo },
    //         { new: true }
    //       )
    //       return foundAuthor
    //     } catch (error) {
    //       throw new UserInputError(error.message, { invalidArgs: args })
    //     }
    //   },
    createUser: async (root, args) => {
      try {
        const user = new User({ ...args })
        await user.save()
        return user
      } catch (error) {
        throw new UserInputError(error.message, { invalidArgs: args })
      }
    },
    //   login: async (root, args) => {
    //     const user = await User.findOne({ username: args.username })

    //     if (!user || args.password !== 'secret') {
    //       throw new UserInputError('wrong credentials assHat')
    //     }
    //     const userForToken = {
    //       username: user.username,
    //       id: user._id,
    //     }
    //     return {
    //       value: jwt.sign(userForToken, JWT_SECRET),
    //     }
    //   },
  },
  //   Subscription: {
  //     bookAdded: {
  //       subscribe: () => pubsub.asyncIterator(['BOOK_ADDED']),
  //     },
  //   },
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

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})
