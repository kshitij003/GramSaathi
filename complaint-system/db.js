const mongoose = require('mongoose')

const mongoURI = 'mongodb+srv://astudy890:kshitij2004@cluster0.mpvlxwp.mongodb.net/complaintdb?retryWrites=true&w=majority&appName=Cluster0'

const connect = () => {
    mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas')
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message)
    })
}

module.exports = connect