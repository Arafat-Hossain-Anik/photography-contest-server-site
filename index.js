const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3010;
const { MongoClient, ServerApiVersion } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const fileUpload = require('express-fileupload');

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
    useTempFiles: true
}));


// couldinary config for image
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});


// connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.weuxy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// creating api
async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        console.log('Database Connected Successfully');
        // crating database and collection
        const database = client.db("photographyContestDB");
        const contestCollection = database.collection("contestInfo");
        const usersCollection = database.collection("users");
        const contestPictureCollection = database.collection("contestPicture");
        app.get('/', (req, res) => {
            res.send('Hello World');
        })
        // make contest(write api)
        app.post('/createcontest', async (req, res) => {
            const contestData = req.body;
            const image = req.files.image;
            const cloudResult = await cloudinary.uploader.upload(image.tempFilePath);
            const imageUrl = cloudResult.url;
            const contestEntry = {
                ...contestData,
                image: imageUrl
            }
            console.log(contestEntry);
            const result = await contestCollection.insertOne(contestEntry);
            // const result = true;
            res.json(result);
        })
        //read contest api
        app.get('/contests', async (req, res) => {
            const cursor = contestCollection.find({});
            const page = req.query.page;
            const size = parseInt(req.query.size);
            const count = await contestCollection.estimatedDocumentCount();
            let result;
            if (page) {
                result = await cursor.skip(page * 2).limit(size).toArray();
            }
            else {
                result = await cursor.toArray();
            }
            res.send({
                count,
                result
            });
        })
        //all contest
        app.get('/contest', async (req, res) => {
            const cursor = contestCollection.find({});
            const result = await cursor.toArray();
            res.send(result);
        })
        //read single contest details
        app.get('/contest/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: ObjectId(id) };
            const service = await contestCollection.findOne(query);
            res.json(service)
        })
        // /contest/${id}/${email}/image
        // contest image upload using image buffer
        // app.post('/contest/:id/:email/image', async (req, res) => {
        //     const id = req.params.id;
        //     const email = req.params.email;
        //     // console.log(id, email);
        //     const image = req.files.image;
        //     const imageData = image.data;
        //     const encodedImage = imageData.toString('base64');
        //     const imageBuffer = Buffer.from(encodedImage, 'base64');
        //     const contestEntry = {
        //         contestId: id,
        //         userEmail: email,
        //         contestImage: imageBuffer,
        //         vote: []
        //     }
        //     const result = await contestPictureCollection.insertOne(contestEntry);
        //     // /console.log(`userId ${result.insertedId} were inserted`);
        //     res.json(result);
        // })
        //cloudinary testing image upload
        app.post('/contest/:id/:email/image', async (req, res) => {
            const id = req.params.id;
            const email = req.params.email;
            const image = req.files.image;
            const cloudResult = await cloudinary.uploader.upload(image.tempFilePath);
            const contestEntry = {
                contestId: id,
                userEmail: email,
                contestImage: cloudResult.url,
                vote: []
            }
            const result = await contestPictureCollection.insertOne(contestEntry);
            res.json(result);
        })
        // contest entry read
        app.get('/entries/:id', async (req, res) => {
            // console.log("params", req.params.id);
            const id = req.params.id;
            const query = { contestId: id };
            const cursor = contestPictureCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        //all entries
        app.get('/entries', async (req, res) => {
            const cursor = contestPictureCollection.find({});
            const result = await cursor.toArray();
            res.send(result);
        })
        // find users single entry
        app.get('/entry/:id/:email', async (req, res) => {
            const id = req.params.id;
            const email = req.params.email;
            const query = { contestId: id };
            const cursor = contestPictureCollection.find(query);
            const result = await cursor.toArray();
            console.log(email);
            let resultArray = result.find(({ userEmail }) => userEmail === email);
            if (!resultArray) {
                resultArray = { userEmail: null }
            }
            console.log(resultArray);
            res.send(resultArray);
        })
        //photo voting
        app.patch('/vote/:id', async (req, res) => {
            email = req.body.email;
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const option = { upsert: true };
            const updateDoc = {
                $push: {
                    vote: email
                },
            };
            const result = await contestPictureCollection.updateOne(filter, updateDoc, option);
            console.log(
                `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`,
            );
            console.log(result);
            res.send(result);
        });
        // insertion user api 
        app.post('/user', async (req, res) => {
            const userData = req.body;
            const result = await usersCollection.insertOne(userData);
            // /console.log(`userId ${result.insertedId} were inserted`);
            res.json(result);
        })
        //update user
        app.put('/users', async (req, res) => {
            const email = req.body;
            // console.log(email);
            const filter = { email: email.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    email: email.email,
                    role: `admin`
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            console.log(
                `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`,
            );
            console.log(result);
            res.send(result);
        });
        //read user api
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find({});
            const result = await cursor.toArray();
            res.send(result);
        });
        //delete one from contests list
        app.delete('/contest/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await contestCollection.deleteOne(query);
            res.json(result);
            console.log(result);
        });

    }
    finally {
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`app listening on port ${port}`);
})
