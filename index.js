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

const pubsub = new PubSub()

const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'

const MONGODB_URI =
  // 'mongodb+srv://gram:11Database1@cluster0.rkkiu.mongodb.net/graphqlBooksExercise?retryWrites=true&w=majority'
  'mongodb://gram:11Database1@cluster0-shard-00-00.rkkiu.mongodb.net:27017,cluster0-shard-00-01.rkkiu.mongodb.net:27017,cluster0-shard-00-02.rkkiu.mongodb.net:27017/graphqlBooksExercise?ssl=true&replicaSet=atlas-yax6gk-shard-0&authSource=admin&retryWrites=true&w=majority'

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
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }
  type Book {
    title: String!
    published: String!
    author: Author!
    id: ID!
    genres: [String!]!
  }
  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int!
  }
  type Mutation {
    addBook(
      title: String!
      published: String!
      genres: [String!]!
      author: String!
    ): Book
    editAuthor(author: String!, setBornTo: String!): Author
    createUser(username: String!, favoriteGenre: String!): User
    login(username: String!, password: String!): Token
  }
  type Subscription {
    bookAdded: Book!
  }
`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      if (!args.author && !args.genre) {
        return await Book.find({}).populate('author')
      }
      if (args.author) {
        return Book.findOne({ author: args.author }) //doesn't need to be working for the current exercise
      }
      return await Book.find({ genres: { $in: [args.genre] } }).populate(
        'author'
      )
    },
    allAuthors: () => Author.find({}),
    me: (root, args, context) => {
      return context.currentUser
    },
  },

  Author: {
    bookCount: async (root) => {
      const books = await Book.find({}).populate('author')
      return books.filter((book) => root.name === book.author.name).length
    },
  },
  Book: { author: (root) => Author.findById(root.author) },
  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser
      if (!currentUser) {
        throw new AuthenticationError('NOT AUthorIZED!!!')
      }
      let foundAuthor = await Author.findOne({ name: args.author })
      const book = new Book({ ...args })

      if (!foundAuthor) {
        const author = new Author({ name: args.author })
        try {
          await author.save()
          book.author = author._id
          await book.save()
        } catch (error) {
          throw new UserInputError(error.message, { invalidArgs: args })
        }
      } else {
        try {
          book.author = foundAuthor._id
          await book.save()
        } catch (error) {
          throw new UserInputError(error.message, { invalidArgs: args })
        }
      }
      pubsub.publish('BOOK_ADDED', { bookAdded: book })

      return book
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser
      if (!currentUser) {
        throw new AuthenticationError('AUTH ERROR in editAuthor!!!')
      }
      try {
        let foundAuthor = await Author.findOneAndUpdate(
          { name: args.author },
          { born: args.setBornTo },
          { new: true }
        )
        return foundAuthor
      } catch (error) {
        throw new UserInputError(error.message, { invalidArgs: args })
      }
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
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })

      if (!user || args.password !== 'secret') {
        throw new UserInputError('wrong credentials assHat')
      }
      const userForToken = {
        username: user.username,
        id: user._id,
      }
      return {
        value: jwt.sign(userForToken, JWT_SECRET),
      }
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(['BOOK_ADDED']),
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

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})
