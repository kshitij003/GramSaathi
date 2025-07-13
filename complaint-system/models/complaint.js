const mongoose = require('mongoose')
// const dbconnect = require('../db')

// Complaint Schema
const ComplaintSchema = mongoose.Schema({
    name: {
        type: String
    },
    email: {
        type: String
    },
    contact: {
        type: String
    },
    desc: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'resolved'],
        default: 'pending'
    },
    createdBy: {
        type: String // store username or user id
    }
});

const Complaint = module.exports = mongoose.model('Complaint', ComplaintSchema);

module.exports.registerComplaint = async function (newComplaint) {
    return await newComplaint.save();
}

module.exports.getAllComplaints = async function(){
    return await Complaint.find();
}