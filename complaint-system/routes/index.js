const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const os = require('os');
const FormData = require('form-data');

let User = require('../models/user');
let Complaint = require('../models/complaint');
let ComplaintMapping = require('../models/complaint-mapping');

// Home Page - Dashboard
router.get('/', ensureAuthenticated, (req, res, next) => {
    res.render('index');
});

// Login Form
router.get('/login', (req, res, next) => {
    res.render('login');
});

// Register Form
router.get('/register', (req, res, next) => {
    res.render('register');
});

// Logout
router.get('/logout', ensureAuthenticated,(req, res, next) => {
    req.logout();
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
});

// Admin
router.get('/admin', ensureAuthenticated, async (req, res, next) => {
    try {
        // Filtering logic for counts
        const allComplaints = await Complaint.getAllComplaints();
        const engineer = await User.getEngineer();
        const mappings = await ComplaintMapping.find();

        // Helper maps
        const assignedComplaintIds = mappings.map(m => m.complaintID);
        const resolvedComplaints = allComplaints.filter(c => c.status === 'resolved');
        const assignedComplaints = allComplaints.filter(c => assignedComplaintIds.includes(String(c._id)) && c.status !== 'resolved');
        const pendingComplaints = allComplaints.filter(c => c.status === 'pending');
        const totalComplaints = allComplaints.filter(c => c.status !== 'resolved');

        res.render('admin/admin', {
            complaints: allComplaints,
            engineer: engineer,
            totalCount: totalComplaints.length,
            pendingCount: pendingComplaints.length,
            assignedCount: assignedComplaints.length,
            resolvedCount: resolvedComplaints.length
        });
    } catch (err) {
        next(err);
    }
});

// Admin filter buttons (optional: can use query params instead)
router.get('/admin/filter/:type', ensureAuthenticated, async (req, res, next) => {
    try {
        const type = req.params.type;
        const allComplaints = await Complaint.getAllComplaints();
        const engineer = await User.getEngineer();
        const mappings = await ComplaintMapping.find();
        const assignedComplaintIds = mappings.map(m => m.complaintID);
        let filtered = [];
        if (type === 'total') filtered = allComplaints.filter(c => c.status !== 'resolved');
        else if (type === 'pending') filtered = allComplaints.filter(c => c.status === 'pending');
        else if (type === 'assigned') filtered = allComplaints.filter(c => assignedComplaintIds.includes(String(c._id)) && c.status !== 'resolved');
        else if (type === 'resolved') filtered = allComplaints.filter(c => c.status === 'resolved');
        res.render('admin/admin', {
            complaints: filtered,
            engineer: engineer,
            totalCount: allComplaints.filter(c => c.status !== 'resolved').length,
            pendingCount: allComplaints.filter(c => c.status === 'pending').length,
            assignedCount: allComplaints.filter(c => assignedComplaintIds.includes(String(c._id)) && c.status !== 'resolved').length,
            resolvedCount: allComplaints.filter(c => c.status === 'resolved').length
        });
    } catch (err) {
        next(err);
    }
});

// Assign the Complaint to Engineer
router.post('/assign', async (req,res,next) => {
    const complaintID = req.body.complaintID;
    const engineerName = req.body.engineerName;

    req.checkBody('complaintID', 'Contact field is required').notEmpty();
    req.checkBody('engineerName', 'Description field is required').notEmpty();

    let errors = req.validationErrors();

    if (errors) {
        res.render('admin/admin', {
            errors: errors
        });
    } else {
        const newComplaintMapping = new ComplaintMapping({
            complaintID: complaintID,
            engineerName: engineerName,
        });
        try {
            await ComplaintMapping.registerMapping(newComplaintMapping);
            // Update complaint status to 'assigned'
            await Complaint.findByIdAndUpdate(complaintID, { status: 'assigned' });
            req.flash('success_msg', 'You have successfully assigned a complaint to Engineer');
            res.redirect('/admin');
        } catch (err) {
            next(err);
        }
    }
});

// Junior Eng - show only assigned complaints
router.get('/jeng', ensureAuthenticated, async (req,res,next) => {
    try {
        const mappings = await ComplaintMapping.find({ engineerName: req.user.username });
        const complaintIds = mappings.map(m => m.complaintID);
        const complaints = await Complaint.find({ _id: { $in: complaintIds } });
        res.render('junior/junior', { complaints });
    } catch (err) {
        next(err);
    }
});

// Engineer marks complaint as resolved
router.post('/resolve', ensureAuthenticated, async (req, res, next) => {
    const complaintID = req.body.complaintID;
    try {
        await Complaint.findByIdAndUpdate(complaintID, { status: 'resolved' });
        req.flash('success_msg', 'Complaint marked as resolved');

        // Send final.m4a to the new webhook
        const audioPath = 'C:/Users/Admin/Desktop/code for bharat/final.m4a';
        const webhookUrl = 'https://kshitij2004.app.n8n.cloud/webhook-test/73ed4caf-9699-4c6f-840d-c8151eb393a1';
        console.log('Checking file:', audioPath, 'Exists:', fs.existsSync(audioPath));
        let webhookResult = null;
        if (fs.existsSync(audioPath)) {
            const form = new FormData();
            form.append('file', fs.createReadStream(audioPath), {
                filename: 'final.m4a',
                contentType: 'audio/mp4'
            });
            try {
                console.log('Sending final.m4a to webhook...');
                const response = await axios.post(webhookUrl, form, {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                webhookResult = { status: response.status, data: response.data };
                console.log('final.m4a sent to webhook, response status:', response.status, response.data);
            } catch (err) {
                if (err.response) {
                    webhookResult = { status: err.response.status, data: err.response.data };
                    console.error('Webhook error:', err.response.status, err.response.data);
                } else {
                    webhookResult = { error: err.message };
                    console.error('Error sending final.m4a to webhook:', err.message);
                }
            }
        } else {
            webhookResult = { error: 'Audio file not found' };
            console.error('Audio file not found:', audioPath);
        }

        res.redirect('/jeng');
    } catch (err) {
        next(err);
    }
});

// Complaint
router.get('/complaint', ensureAuthenticated, async (req, res, next) => {
    try {
        const complaints = await Complaint.find({ createdBy: req.user.username });
        res.render('complaint', {
            username: req.session.user,
            myComplaints: complaints
        });
    } catch (err) {
        next(err);
    }
});

// Register a Complaint
router.post('/registerComplaint', async (req, res, next) => {
    const name = req.body.name;
    const email = req.body.email;
    const contact = req.body.contact;
    const desc = req.body.desc;
    const createdBy = req.user ? req.user.username : '';
    req.checkBody('contact', 'Contact field is required').notEmpty();
    req.checkBody('desc', 'Description field is required').notEmpty();
    let errors = req.validationErrors();
    if (errors) {
        res.render('complaint', {
            errors: errors
        });
    } else {
        const newComplaint = new Complaint({
            name: name,
            email: email,
            contact: contact,
            desc: desc,
            createdBy: createdBy,
            status: 'pending'
        });
        try {
            await Complaint.registerComplaint(newComplaint);
            req.flash('success_msg', 'You have successfully launched a complaint');
            res.redirect('/');
        } catch (err) {
            next(err);
        }
    }
});

// User: View all complaints registered by them
router.get('/mycomplaints', ensureAuthenticated, async (req, res, next) => {
    try {
        const complaints = await Complaint.find({ createdBy: req.user.username });
        res.render('mycomplaints', { myComplaints: complaints });
    } catch (err) {
        next(err);
    }
});

// Process Register
router.post('/register', (req, res, next) => {
    const name = req.body.name;
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password2;
    const role = req.body.role;

    req.checkBody('name', 'Name field is required').notEmpty();
    req.checkBody('email', 'Email field is required').notEmpty();
    req.checkBody('email', 'Email must be a valid email address').isEmail();
    req.checkBody('username', 'Username field is required').notEmpty();
    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password2', 'Passwords do not match').equals(req.body.password);
    req.checkBody('role', 'Role option is required').notEmpty();

    let errors = req.validationErrors();

    if (errors) {
        res.render('register', {
            errors: errors
        });
    } else {
        const newUser = new User({
            name: name,
            username: username,
            email: email,
            password: password,
            role: role
        });

        User.registerUser(newUser, (err, user) => {
            if (err) throw err;
            req.flash('success_msg', 'You are Successfully Registered and can Log in');
            res.redirect('/login');
        });
    }
});

// Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.getUserByUsername(username);
        if (!user) {
            return done(null, false, {
                message: 'No user found'
            });
        }
        const isMatch = await User.comparePassword(password, user.password);
        if (isMatch) {
            return done(null, user);
        } else {
            return done(null, false, {
                message: 'Wrong Password'
            });
        }
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    var sessionUser = {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
    }
    done(null, sessionUser);
});

passport.deserializeUser(async (id, done) => {
    try {
        const sessionUser = await User.getUserById(id);
        done(null, sessionUser);
    } catch (err) {
        done(err);
    }
});

// Login Processing
router.post('/login', passport.authenticate('local', 
    { 
        failureRedirect: '/login', 
        failureFlash: true 
    
    }), (req, res, next) => {
    
        req.session.save((err) => {
        if (err) {
            return next(err);
        }
        if(req.user.role==='admin'){
            res.redirect('/admin');
        }
        else if(req.user.role==='jeng'){
            res.redirect('/jeng');
        }
        else{
            res.redirect('/');
        }
    });
});

// Access Control
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        req.flash('error_msg', 'You are not Authorized to view this page');
        res.redirect('/login');
    }
}

// Voice Complaint API
router.post('/voiceComplaint', async (req, res) => {
    const { letter } = req.body;
    if (!letter) {
        return res.status(400).json({ success: false, error: 'No letter provided' });
    }
    const Complaint = require('../models/complaint');
    const newComplaint = new Complaint({
        name: 'whatsapp complaint',
        email: null,
        contact: +919557797469,
        desc: letter
    });
    try {
        const complaint = await newComplaint.save();
        
        // Send the local file as multipart/form-data to the webhook
        const audioPath = 'C:/Users/Admin/Desktop/code for bharat/Recording.m4a';
        const webhookUrl = 'https://kshitij2004.app.n8n.cloud/webhook-test/75f48681-a7a2-4c57-a995-733f78ab7b36';

        console.log('Checking file:', audioPath, 'Exists:', fs.existsSync(audioPath));
        let webhookResult = null;
        if (fs.existsSync(audioPath)) {
            const form = new FormData();
            form.append('file', fs.createReadStream(audioPath), {
                filename: 'Recording.m4a',
                contentType: 'audio/mp4'
            });

            try {
                console.log('Sending audio to webhook...');
                const response = await axios.post(webhookUrl, form, {
                    headers: form.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                webhookResult = { status: response.status, data: response.data };
                console.log('Audio sent to webhook, response status:', response.status, response.data);
            } catch (err) {
                if (err.response) {
                    webhookResult = { status: err.response.status, data: err.response.data };
                    console.error('Webhook error:', err.response.status, err.response.data);
                } else {
                    webhookResult = { error: err.message };
                    console.error('Error sending audio to webhook:', err.message);
                }
            }
        } else {
            webhookResult = { error: 'Audio file not found' };
            console.error('Audio file not found:', audioPath);
        }

        return res.json({ success: true, complaint, webhookResult });
    } catch (err) {
        console.error('Error in /voiceComplaint:', err.message);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;