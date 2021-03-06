const express = require("express");
const http = require("http");
const morgan = require("morgan");
const helmet = require("helmet");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");

//importing Models
const User = require("./Models/User");
const Post = require("./Models/Post");

// DotENV config
require("dotenv").config();

// Declaring the express app
const app = express();

// Connecting to Database
const dbUrl = process.env.DB_URL || "";
const dbName = process.env.DB_NAME || "";
mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName,
  })
  .then(() => console.log("Connected to MongoDB..."))
  .catch((error) => console.log("MongoDB Error:\n", error));
mongoose.set("useCreateIndex", true);

// Morgan for logging requests
app.use(morgan("tiny"));

// A little security using helmet
app.use(helmet());

// CORS
app.use(cors());
// app.use(cors({ origin: ["http://localhost:3000", "https://yasn.now.sh"] }));

const server = http.createServer(app);

// JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Cookie middlewares
app.use(
  cookieSession({
    name: "session",
    keys: ["#secretKey"],
  })
);
app.use(cookieParser());

//Routes
app.get("/checkprofile", (req, res) => {
  const email = req.query.email;
  User.find({ email }, (err, user) => {
    console.log(err);
    console.log(user);
    user.length !== 0 ? res.send(user) : res.send(false);
  });
});

app.post("/adduser", (req, res) => {
  console.log(req.cookies);
  console.log(req.body.name);
  const newUser = {
    name: req.body.name,
    email: req.body.email,
    username: req.body.username,
    clubsNumber: req.body.tags.length,
    bio: req.body.bio,
    gitHubUrl: req.body.gitHubUrl,
    linkedInUrl: req.body.linkedInUrl,
    instaUrl: req.body.instaUrl,
    clubsComm: req.body.tags,
  };
  User.find({ username: req.body.username }, (err, user) => {
    console.log(err);
    user.length !== 0 ? res.send("username already taken") : null;
  });

  User.create(newUser)
    .then((res) => console.log(res))
    .catch((err) => console.log(err));

  res.send("success");
});

app.get("/profile", (req, res) => {
  const email = req.query.email;
  User.find({ email })
    .populate("posts")

    .exec((err, user) => {
      if (err) {
        console.log(err);
      }
      user.length !== 0 ? res.send(user) : res.send(false);
    });
});

app.get("/username", (req, res) => {
  const username = req.query.username;
  User.find({ username })
    .populate("posts")

    .exec((err, user) => {
      if (err) {
        console.log(err);
      }
      console.log(user);
      user.length !== 0 ? res.send(user) : res.send(false);
    });
});

app.get("/home", (req, res) => {
  const tag = req.query.tag;

  Post.find(tag ? { tags: tag } : {})
    .sort({ date: -1 })
    .populate("creator")
    .exec((err, posts) => {
      if (err) {
        console.log(err);
      }
      res.send(posts);
    });
});

app.post("/addpost", async (req, res) => {
  const email = req.query.email;

  let postId;
  let userId = req.body.currentUserId;
  if (!userId) {
    await User.findOne({ email }, (err, user) => {
      if (err) console.log(err);
      userId = user._id;
      console.log(userId);
    });
  }

  const newPost = {
    creatorEmail: email,
    creator: userId,
    imageUrl: req.body.imageUrl,
    videoUrl: req.body.videoUrl,
    title: req.body.title,
    description: req.body.description,
    tags: req.body.tags,
    comments: req.body.comments,
    likes: { count: req.body.likesCount },
  };

  await Post.create(newPost)
    .then((res) => {
      console.log(res);
      postId = res._id;
    })
    .catch((err) => console.log(err));

  await Post.findOne({ _id: postId })
    .populate("creator")
    .exec((err, post) => {
      if (err) return handleError(err);
      console.log(post);
    });

  const updatedUser = await User.update(
    { _id: userId },
    {
      $push: { posts: postId },
    }
  );
  console.log(updatedUser);

  res.send("successfully added post");
});

app.post("/handlelike", async (req, res) => {
  let updatedPost;

  const postId = req.query._id;
  const userId = req.body.currentUserId;
  const liked = req.body.liked;
  console.log(postId);

  if (liked && userId) {
    updatedPost = await Post.updateOne(
      { _id: postId },
      { $push: { "likes.likers": userId } }
    );
    console.log(updatedPost);
  } else {
    updatedPost = await Post.updateOne(
      { _id: req.query._id },
      { $pull: { "likes.likers": userId } }
    );
    console.log(updatedPost);
  }

  res.send("success");
});

app.post("/addcomment", (req, res) => {
  Post.updateOne(
    { _id: req.body.postId },
    {
      $push: {
        comments: {
          commentBy: req.body.userId,
          comment: req.body.comment,
          username: req.body.username,
          name: req.body.name,
        },
      },
    }
  )
    .then((res) => {
      console.log(res);
    })
    .catch((err) => console.log(err));
  res.send("success");
});

const port = process.env.PORT || 4848;

server.listen(port, () => {
  console.log(
    `Server is running in ${process.env.NODE_ENV} mode on port ${port}...`
  );
});
