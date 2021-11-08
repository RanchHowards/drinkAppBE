const {
  ApolloServer,
  gql,
  UserInputError,
  AuthenticationError,
} = require('apollo-server')

const { GraphQLScalarType, Kind } = require('graphql')

const mongoose = require('mongoose')
require('dotenv').config()
const bcrypt = require('bcrypt')
const saltRounds = 10
const jwt = require('jsonwebtoken')

const User = require('./models/user')
const Event = require('./models/event')
const Comment = require('./models/comment')

//MONGOOSE
const JWT_SECRET = process.env.SECRET

const MONGODB_URI = process.env.MONGODB

const PORT = process.env.PORT || 4000

// console.log('connecting to', MONGODB_URI)

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
  scalar Date

  type User {
    username: String!
    passwordHash: String
    pic: String
    drink: String
    id: ID!
    myEvents: [Event]
  }

  type Token {
    value: String!
    user: User
  }
  type Event {
    title: String
    host: User
    attendees: [User]
    location: String
    eventType: String
    eventPic: String
    description: String
    max: Boolean
    maxGuests: Int
    eventDate: Date
    createdAt: Date
    comments: [Comment]
    id: ID
  }
  type Comment {
    comment: String
    author: User!
    event: Event!
    responses: [Comment]
    id: ID!
  }

  type Query {
    eventCount: Int!
    allEvents: [Event]
    weeksEvents: [Event]
    allUsers: [User]
    findEvent(eventId: ID!): Event
    me: User
    allComments: [Comment]
    findComments(eventId: ID!): [Comment]
  }
  type Mutation {
    addEvent(
      title: String
      eventType: String
      eventPic: String
      location: String
      description: String
      max: Boolean
      maxGuests: Int
      eventDate: Date
    ): Event
    editEvent(
      title: String
      eventType: String
      eventPic: String
      location: String
      description: String
      max: Boolean
      maxGuests: Int
      eventDate: Date
      eventId: ID!
    ): Event
    deleteEvent(eventId: ID!): Event
    joinEvent(eventId: ID!, userId: ID!): Event
    leaveEvent(eventId: ID!, userId: ID!): Event
    createUser(
      username: String!
      password: String!
      drink: String
      pic: String
    ): Token
    login(username: String!, password: String!): Token
    createComment(eventId: ID!, comment: String!, inResponseTo: ID): Comment
  }
`

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) {
    return value // removed toISOString()
  },
  parseValue(value) {
    return new Date(value) // Convert incoming integer to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10)) // Convert hard-coded AST string to integer and then to Date
    }
    return null // Invalid hard-coded value (not an integer)
  },
})

const resolvers = {
  Date: dateScalar,
  Query: {
    eventCount: () => Event.collection.countDocuments(),
    allEvents: async () => {
      const d = new Date()
      const today = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return await Event.find({ eventDate: { $gte: today } })
        .populate('host')
        .populate('attendees')
        .populate({
          path: 'comments',
          populate: {
            path: 'author',
            model: 'User',
          },
        })
    },
    allUsers: async () => {
      return await User.find({})
    },
    weeksEvents: async (root, args, context) => {
      const today = new Date()
      const week = new Date(today.setDate(today.getDate() + 6))
      try {
        return await Event.find({ eventDate: { $lte: week } })
          .populate('attendees')
          .populate('host')
      } catch (error) {
        throw new Error(
          'someting wrong from BE query weeksEvents',
          error.message
        )
      }
    },
    findEvent: async (root, { eventId }) => {
      try {
        return await Event.findById(eventId)
          .populate('attendees')
          .populate('host')
          .populate({
            path: 'comments',
            populate: {
              path: 'author',
              model: 'User',
            },
          })
      } catch (error) {
        throw new Error('problem in BE with findEvent', error.message)
      }
    },
    me: async (root, args, { currentUser }) => {
      if (!currentUser) {
        return
      }
      try {
        const user = await User.findById(currentUser._id).populate('myEvents')
        return user
      } catch (error) {
        throw new Error(
          'something wrong with ME query on the BACKEND',
          error.message
        )
      }
    },
    allComments: async (root) => {
      return await Comment.find({}).populate('author').populate('event')
    },
    findComments: async (root, { eventId }) => {
      try {
        const event = await Event.findByIdAndUpdate(eventId).populate({
          path: 'comments',
          populate: {
            path: 'author',
            model: 'User',
          },
        })
        return event.comments
      } catch (err) {
        throw new Error('error from BackEnd findComments query', err.message)
      }
    },
  },

  Mutation: {
    addEvent: async (root, args, { currentUser }) => {
      const {
        title,
        eventType,
        eventPic,
        location,
        eventDate,
        description,
        max,
        maxGuests,
      } = args
      if (!currentUser) {
        throw new AuthenticationError('NOT AUthorIZED, bub!!!')
      }

      const event = new Event({
        title,
        eventType,
        eventPic,
        location,
        eventDate,
        description,
        max,
        maxGuests,
        host: currentUser._id,
      })
      try {
        await event.save()
        const user = await User.findById(currentUser._id)
        user.myEvents.push(event._id) //can't use concat
        await user.save()
      } catch (error) {
        throw new Error(error.message)
      }
      return event
    },
    editEvent: async (root, args, { currentUser }) => {
      const {
        title,
        eventType,
        eventPic,
        location,
        eventDate,
        description,
        max,
        maxGuests,
        eventId,
      } = args
      if (!currentUser) {
        throw new AuthenticationError('Not authorized from BE & editEvent')
      }
      try {
        const filter = { _id: eventId }
        const update = {
          title,
          eventType,
          eventPic,
          location,
          description,
          max,
          maxGuests,
          eventDate,
        }
        const event = await Event.findOneAndUpdate(filter, update, {
          new: true,
        })
        await event.save()

        return event
      } catch (error) {
        throw new UserInputError('error from editEvent BE', error)
      }
    },
    deleteEvent: async (root, { eventId }, { currentUser }) => {
      try {
        const foundEvent = await Event.findById(eventId)

        if (currentUser.id === foundEvent.host.toString()) {
          await Event.findOneAndDelete({ _id: eventId })
        } else throw Error
      } catch (err) {
        throw new Error('error from BE trying to delete event')
      }
    },
    joinEvent: async (root, { userId, eventId }, { currentUser }) => {
      if (!currentUser) {
        throw new AuthenticationError('Not authorized from BE & JoinEvent')
      }
      try {
        const event = await Event.findById(eventId)
        event.attendees.push(userId)
        event.populate('attendees').execPopulate()

        await event.save()
        return event
      } catch (error) {
        throw new Error(error.message)
      }
    },
    leaveEvent: async (root, { userId, eventId }, { currentUser }) => {
      if (!currentUser) {
        throw new AuthenticationError('Not authorized from BE & LEAVEEvent')
      }
      try {
        const update = { $pull: { attendees: userId } }
        const event = await Event.findByIdAndUpdate(eventId, update, {
          new: true,
        }).populate('attendees')

        await event.save()
        return event
      } catch (error) {
        throw new Error(error.message)
      }
    },

    createUser: async (root, { username, password, drink, pic }) => {
      try {
        const salt = await bcrypt.genSalt(saltRounds)
        const passwordHash = await bcrypt.hash(password, salt)
        const user = new User({ username, passwordHash, drink, pic })
        await user.save()

        const userForToken = {
          username: user.username,
          id: user._id,
        }
        return { value: jwt.sign(userForToken, JWT_SECRET), user }
      } catch (error) {
        if (error.code === 11000) {
          throw new Error('Username is already taken')
        }
        throw new UserInputError(error.message)
      }
    },
    login: async (root, { username, password }) => {
      const user = await User.findOne({ username }).populate('myEvents')
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
      return {
        value: jwt.sign(userForToken, JWT_SECRET),
        user,
      }
    },
    createComment: async (root, args, { currentUser }) => {
      try {
        const { eventId, comment } = args

        const newComment = new Comment({
          comment,
          author: currentUser.id,
          event: eventId,
        })
        newComment.populate('author').execPopulate()
        await newComment.save()

        const foundEvent = await Event.findById(eventId)
        foundEvent.comments.push(newComment._id)
        await foundEvent.save()

        if (args.inResponseTo) {
          const aboveComment = await Comment.findById(inResponseTo)
          aboveComment.responses.push(newComment._id)
          await aboveComment.save()
        }
        return newComment
      } catch (err) {
        throw new Error('error from BackEnd createComment', err.message)
      }
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

server.listen({ port: PORT }).then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})
