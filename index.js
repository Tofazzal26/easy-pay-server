const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
app.use(cookieParser());
require("dotenv").config();
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rgxjhma.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const UserCollection = client.db("Easy_Pay").collection("user");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Forbidden Access: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.SECURE_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .json({ message: `Forbidden Access: ${error.message}` });
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    app.get("/verifyToken", verifyToken, (req, res) => {
      res.status(200).json({ message: "Token is valid", user: req.decoded });
    });

    app.post("/user", async (req, res) => {
      try {
        const user = req.body;
        const result = await UserCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.send({ message: "There was a server error", error });
      }
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECURE_TOKEN, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Easy Pay is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
