require("dotenv").config();

const stripe = require("stripe")(process.env.VITE_SECRET_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2tkvzo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // ---------------------------COLLECTIONS START---------------------------------
    const productsCollection = client.db("product-hunt").collection("products");
    const userCollection = client.db("product-hunt").collection("users");
    const paymentCollection = client.db("product-hunt").collection("payments");
    const reviewCollection = client.db("product-hunt").collection("reviews");
    // ---------------------------COLLECTIONS END---------------------------------

    // ----------------------------PAYMENT INTENT START--------------------------------------

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Save payment History
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    });

    // ----------------------------PAYMENT INTENT END--------------------------------------

    // ----------------------------PRODUCTS COLLECTION START----------------------------------
    // Save Products
    app.post("/products", async (req, res) => {
      const products = req.body;
      const result = await productsCollection.insertOne(products);
      res.send(result);
    });

    // get products data for products page
    app.get("/all-product", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    // get products data count
    app.get("/all-product-count", async (req, res) => {
      const count = await productsCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // Pagination
    app.get("/product-pagination", async (req, res) => {
      const page = Number(req.query.page);
      const size = Number(req.query.size);

      const result = await productsCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    // get products data search by tags
    app.get("/product/search", async (req, res) => {
      const searchTags = req.query.tags;

      let query = {
        tags: {
          $regex: searchTags,
          $options: "i",
        },
      };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });
    // get products data
    app.get("/products", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });

    // get Products data by specific email
    app.get("/specific-product/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        ownerEmail: email,
      };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    // get product data by id for update
    app.get("/get-product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // products Data update
    app.put("/product-update/:id", async (req, res) => {
      const id = req.params.id;
      const updateProduct = req.body;
      const filter = { _id: new ObjectId(id) };

      const update = {
        $set: updateProduct,
      };
      const result = await productsCollection.updateOne(filter, update);
      res.send(result);
    });

    // Products data votes update
    app.patch("/products/vote/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { userEmail } = req.body;

      const product = await productsCollection.findOne(filter);

      if (!product) {
        return res.status(404).send({ message: "Product not found" });
      }

      //   Only one time a user can vote
      if (product.votedUser === userEmail) {
        return res.status(403).send({ message: "You already voted" });
      }
      const update = {
        $inc: { votes: 1 },
        $set: { votedUser: userEmail },
      };

      const result = await productsCollection.updateOne(filter, update);

      res.send(result);
    });
    // Products data Report update
    app.patch("/products/report/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { userEmail } = req.body;

      const product = await productsCollection.findOne(filter);

      if (!product) {
        return res.status(404).send({ message: "Product not found" });
      }

      //   Only one time a user can report
      if (product.reportedUser === userEmail) {
        return res.status(403).send({
          message: "You already Report, Please wait for moderator action.",
        });
      }
      const update = {
        $inc: { report: 1 },
        $set: { reportedUser: userEmail, reportedStatus: "reported" },
      };

      const result = await productsCollection.updateOne(filter, update);

      res.send(result);
    });

    // Products data update by moderator
    app.patch("/product/reviewQueue-update/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      let update = {
        $set: {
          isFeatured: true,
        },
      };
      if (status === "Accepted") {
        update = {
          $set: {
            status,
          },
        };
      }
      if (status === "Rejected") {
        update = {
          $set: {
            status,
          },
        };
      }
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    // product data delete
    app.delete("/product-data-delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // get product data for moderator review
    app.get("/product-review", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });
    // get report product data for moderator action
    app.get("/product-reported", async (req, res) => {
      const result = await productsCollection
        .find({ reportedStatus: "reported" })
        .toArray();
      res.send(result);
    });

    // get product data by id for Details
    app.get("/product-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // ----------------------------PRODUCTS COLLECTION END----------------------------------

    //  ----------------------------USER COLLECTION START-------------------------------------

    // Save user
    app.post("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const isExist = await userCollection.findOne(query);
      if (isExist) return isExist;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get all user
    app.get("/all-user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection
        .find({ email: { $ne: email } })
        .toArray();
      res.send(result);
    });

    // get user by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // get user by specific email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        email,
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // User collection data update after successful payment
    app.patch("/data-update/:id", async (req, res) => {
      const id = req.params.id;
      const { isSubscribed, subscriptionDate, paymentVerified, status } =
        req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: { isSubscribed, subscriptionDate, paymentVerified, status },
      };
      const result = await userCollection.updateOne(filter, update);
      res.send(result);
    });

    // user collection update by admin action
    app.patch("/user-update/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const query = { _id: new ObjectId(id) };
      let update = {};
      if (role === "moderator") {
        update = {
          $set: {
            role,
          },
        };
      }
      if (role === "admin") {
        update = {
          $set: { role },
        };
      }
      const result = await userCollection.updateOne(query, update);
      res.send(result);
    });

    //  ----------------------------USER COLLECTION END-------------------------------------

    // -----------------------------REVIEWS COLLECTION START--------------------------------

    // Save review data
    app.post("/review-data", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // get specific review data
    app.get("/reviews/:id", async (req, res) => {
      const productId = req.params.id;
      const query = { productId };
      if (!productId) {
        return res.send({ message: "No Reviews" });
      }
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // -----------------------------REVIEWS COLLECTION END----------------------------------

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
  res.send("Product hunt website");
});

app.listen(port, () => {
  console.log("The product hunt website run on port", port);
});
