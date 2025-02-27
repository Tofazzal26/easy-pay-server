const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
app.use(cookieParser());
require("dotenv").config();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://easy-pay-client.vercel.app"],
    credentials: true,
  })
);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
const TransactionCollection = client.db("Easy_Pay").collection("transaction");

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

    app.patch("/userBlock/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const user = req.body;
        const userBlock = {
          $set: {
            isBlocked: user.block,
          },
        };
        const result = await UserCollection.updateOne(
          query,
          userBlock,
          options
        );
        res.send(result);
      } catch (error) {
        res.send({ message: "there was a server error", success: false });
      }
    });
    app.patch("/agentReject/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = req.body;

        const userReject = {
          $push: { notification: user.newNotification },
          $set: { ant: "yes" },
        };
        const result = await UserCollection.updateOne(query, userReject);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "There was a server error", success: false });
      }
    });

    app.patch("/agentAccept/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = req.body;

        const existingUser = await UserCollection.findOne(query);

        let currentBalance = existingUser?.balance || "0";
        let updatedBalance = parseFloat(currentBalance) + 100000;

        const userAccept = {
          $push: { notification: user.newNotification },
          $set: { ant: "yes", balance: updatedBalance.toString() },
        };

        const result = await UserCollection.updateOne(query, userAccept);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "There was a server error", success: false });
      }
    });

    app.get("/totalBalance", async (req, res) => {
      try {
        const result = await UserCollection.aggregate([
          {
            $project: {
              balance: { $toDouble: "$balance" },
            },
          },
          {
            $group: {
              _id: null,
              totalBalance: { $sum: "$balance" },
            },
          },
        ]).toArray();

        const totalBalance = result.length > 0 ? result[0].totalBalance : 0;
        res.send({ totalBalance });
      } catch (error) {
        res.status(500).send({ message: "Server error", success: false });
      }
    });

    app.get("/userData/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await UserCollection.findOne({
          $or: [{ email: email }, { number: email }],
        });
        res.send(result);
      } catch (error) {
        res.send({ message: "There was a server error" });
      }
    });

    app.get("/singleUserTransaction/:number", async (req, res) => {
      try {
        const num = req.params.number;
        const query = {
          $or: [{ senderId: num }, { receiverId: num }],
        };
        const result = await TransactionCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send({ message: "there was a server error", success: false });
      }
    });

    app.get("/transaction/:number", async (req, res) => {
      try {
        const number = req.params.number;
        const result = await TransactionCollection.find({
          $or: [{ senderId: number }, { receiverId: number }],
        }).toArray();
        res.send(result);
      } catch (error) {
        res.send({ message: "there was a server error", success: false });
      }
    });
    app.get("/allUser", async (req, res) => {
      const { number } = req.query;
      let query = {};
      if (number) {
        query = { number: { $regex: `^${number}`, $options: "i" } };
      }
      try {
        const result = await UserCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send({ message: "there was a server error", success: false });
      }
    });

    app.get("/allAgent", async (req, res) => {
      try {
        const rol = "agent";
        const query = { role: rol };
        const result = await UserCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send({ message: "there was a server error", success: false });
      }
    });

    app.get("/allTransaction", async (req, res) => {
      try {
        const result = await TransactionCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.send({ message: "there are was a server error", success: false });
      }
    });

    app.post("/user", async (req, res) => {
      try {
        const user = req.body;
        const pinHash = bcrypt.hashSync(user.pin, 10);
        const newUser = {
          ...user,
          pin: pinHash,
        };
        const nid = user.nid;
        const number = user.number;
        const email = user.email;
        const query = { $or: [{ nid }, { number }, { email }] };
        const existing = await UserCollection.findOne(query);
        if (existing) {
          return res.send({
            message:
              existing.nid === nid
                ? "NID is already in use"
                : existing.number === number
                ? "Mobile number is already in use"
                : "Email is already in use",
            success: true,
          });
        }
        const result = await UserCollection.insertOne(newUser);
        res.send(result);
      } catch (error) {
        res.send({ message: "There was a server error", error });
      }
    });
    app.get("/login", async (req, res) => {
      try {
        const { pin, email } = req.query;
        const existingUser = await UserCollection.findOne({
          $or: [{ email: email }, { number: email }],
        });
        if (!existingUser) {
          return res.send({
            message: "User not found register first",
            success: false,
          });
        }
        const match = bcrypt.compareSync(pin, existingUser.pin);
        if (!match) {
          return res.send({
            message: "Email and Pin not match",
            success: false,
          });
        }
        res.send({
          message: "Login successful",
          success: true,
          user: existingUser,
        });
      } catch (error) {
        res.status(500).send({
          message: "There was a server error",
          error,
        });
      }
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECURE_TOKEN, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    app.post("/sendMoney", async (req, res) => {
      try {
        const {
          type,
          amountSend,
          senderId,
          receiverId,
          fee,
          timestamp,
          status,
          transactionId,
          pin,
        } = req.body;
        const newTransaction = {
          type,
          amountSend,
          senderId,
          receiverId,
          fee,
          timestamp,
          status,
          transactionId,
        };
        const parsedAmountSend = parseFloat(amountSend);
        const parsedFee = parseFloat(fee);
        const admin = await UserCollection.findOne({ role: "admin" });
        const reciver = await UserCollection.findOne({ number: receiverId });
        const sender = await UserCollection.findOne({ number: senderId });
        const pinMatch = bcrypt.compareSync(pin, sender.pin);
        if (!pinMatch) {
          return res.send({
            message: "Pin not match",
            success: false,
          });
        }
        if (!admin) {
          return res.send({
            message: "Admin Not Found",
            success: false,
          });
        }
        if (!reciver) {
          return res.send({
            message: "Reciver User Not Found this app",
            success: false,
          });
        }
        if (!sender) {
          return res.send({
            message: "Sender User Not Found this app",
            success: false,
          });
        }

        const reciverBalance = parseFloat(reciver.balance);
        const senderBalance = parseFloat(sender.balance);
        const adminBalance = parseFloat(admin.balance);
        const updateAdminBalance = adminBalance + parsedFee;
        const updateSenderBalance =
          senderBalance - (parsedAmountSend + parsedFee);
        if (updateSenderBalance < 0) {
          return res.send({ message: "Not enough balance", success: false });
        }
        const updateReciverBalance = reciverBalance + parsedAmountSend;
        await UserCollection.updateOne(
          { role: "admin" },
          { $set: { balance: updateAdminBalance } }
        );
        await UserCollection.updateOne(
          { number: receiverId },
          { $set: { balance: updateReciverBalance } }
        );
        await UserCollection.updateOne(
          { number: senderId },
          { $set: { balance: updateSenderBalance } }
        );
        await TransactionCollection.insertOne(newTransaction);
        await UserCollection.updateOne(
          { number: receiverId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Cash In ${parsedAmountSend} tk and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await UserCollection.updateOne(
          { number: senderId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Send Out ${parsedAmountSend}tk and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        if (parsedFee > 0) {
          await UserCollection.updateOne(
            { role: "admin" },
            {
              $push: {
                notification: {
                  $each: [
                    {
                      msg: `You have recieve ${parsedFee}tk`,
                    },
                  ],
                  $position: 0,
                },
              },
            }
          );
        }

        res.send({
          message: "Send Money Successful",
          success: true,
        });
      } catch (error) {
        res.send({ message: "there was a server error " });
      }
    });

    app.post("/cashOut", async (req, res) => {
      try {
        const {
          type,
          amountSend,
          senderId,
          receiverId,
          fee,
          timestamp,
          status,
          transactionId,
          pin,
        } = req.body;
        const newTransaction = {
          type,
          amountSend,
          senderId,
          receiverId,
          fee,
          timestamp,
          status,
          transactionId,
        };
        const parsedAmountSend = parseFloat(amountSend);
        const parsedFee = parseFloat(fee);
        const adminFee = (parsedFee * 0.5) / 1.5;
        const agentFee = (parsedFee * 1) / 1.5;
        const admin = await UserCollection.findOne({ role: "admin" });
        const reciver = await UserCollection.findOne({ number: receiverId });
        const sender = await UserCollection.findOne({ number: senderId });
        const pinMatch = bcrypt.compareSync(pin, sender.pin);
        if (!pinMatch) {
          return res.send({
            message: "Pin not match",
            success: false,
          });
        }
        if (!reciver) {
          return res.send({
            message: "Reciver User number Not Found this app",
            success: false,
          });
        }
        if (!reciver || reciver.role !== "agent") {
          return res.send({
            message: "This number is not a agent number",
            success: false,
          });
        }
        if (!admin) {
          return res.send({
            message: "Admin Not Found",
            success: false,
          });
        }
        const reciverBalance = parseFloat(reciver.balance);
        const senderBalance = parseFloat(sender.balance);
        const adminBalance = parseFloat(admin.balance);
        const updateAdminBalance = adminBalance + adminFee;
        const updateReciverBalance =
          reciverBalance + parsedAmountSend + agentFee;
        const updateSenderBalance =
          senderBalance - (parsedAmountSend + parsedFee);

        if (updateSenderBalance < 0) {
          return res.send({ message: "Not enough balance", success: false });
        }
        await UserCollection.updateOne(
          { number: receiverId },
          { $set: { balance: updateReciverBalance } }
        );
        await UserCollection.updateOne(
          { number: receiverId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Cash In ${parsedAmountSend}tk and Fee ${agentFee}tk and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await UserCollection.updateOne(
          { number: senderId },
          { $set: { balance: updateSenderBalance } }
        );
        await UserCollection.updateOne(
          { number: senderId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Cash Out ${parsedAmountSend}tk and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await UserCollection.updateOne(
          { role: "admin" },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You have recieve ${adminFee}tk`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await UserCollection.updateOne(
          { role: "admin" },
          { $set: { balance: updateAdminBalance } }
        );
        await TransactionCollection.insertOne(newTransaction);

        res.send({
          message: "Cash Out Successful",
          success: true,
        });
      } catch (error) {
        res.send({ message: "there was a server error" });
      }
    });

    app.post("/cashIn", async (req, res) => {
      try {
        const {
          type,
          amountSend,
          senderId,
          receiverId,
          timestamp,
          status,
          transactionId,
          pin,
        } = req.body;
        const newTransaction = {
          type,
          amountSend,
          senderId,
          receiverId,
          timestamp,
          status,
          transactionId,
        };
        const parsedAmountSend = parseFloat(amountSend);
        const reciver = await UserCollection.findOne({ number: receiverId });
        const sender = await UserCollection.findOne({ number: senderId });
        const pinMatch = bcrypt.compareSync(pin, sender.pin);
        if (!pinMatch) {
          return res.send({
            message: "Pin not match",
            success: false,
          });
        }
        if (!reciver) {
          return res.send({
            message: "Reciver User number Not Found this app",
            success: false,
          });
        }
        const reciverBalance = parseFloat(reciver.balance);
        const senderBalance = parseFloat(sender.balance);
        const updateReciverBalance = reciverBalance + parsedAmountSend;
        const updateSenderBalance = senderBalance - parsedAmountSend;
        if (updateSenderBalance < 0) {
          return res.send({ message: "Not enough balance", success: false });
        }
        await UserCollection.updateOne(
          { number: receiverId },
          { $set: { balance: updateReciverBalance } }
        );
        await UserCollection.updateOne(
          { number: senderId },
          { $set: { balance: updateSenderBalance } }
        );
        await UserCollection.updateOne(
          { number: receiverId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Cash In ${parsedAmountSend}tk  and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await UserCollection.updateOne(
          { number: senderId },
          {
            $push: {
              notification: {
                $each: [
                  {
                    msg: `You Cash Out ${parsedAmountSend}tk  and Transaction ID: ${transactionId}`,
                  },
                ],
                $position: 0,
              },
            },
          }
        );
        await TransactionCollection.insertOne(newTransaction);

        res.send({ message: "Cash In Successful", success: true });
      } catch (error) {
        res.send({ message: "there was a server error" });
      }
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
