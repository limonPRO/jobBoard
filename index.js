// Require necessary modules
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Set up web server
const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mydb', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Define Job model
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    salary: { type: Number, required: true },
    date: { type: Date, default: Date.now },
});
const Job = mongoose.model('Job', jobSchema);

// Define user model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Register a new user
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user) return res.status(400).send('User already registered.');

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, 'secretkey');
    res.header('Authorization', `Bearer ${token}`).send({ message: 'User registered successfully.', newUser, token });
});
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
// Log in an existing user
app.get('/', (req, res) => {
    res.send("working")
})
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('Invalid email or password.');

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(
        400).send('Invalid email or password.');

    const token = jwt.sign({ userId: user._id }, 'secretkey');
    res.header('Authorization', `Bearer ${token}`).send({ message: 'Logged in successfully.', token, user });
});

// Log out the current user
app.post('/logout', (req, res) => {
    res.header('Authorization', '').send({ message: 'Logged out successfully.' });
});

// Create a new job posting
app.post('/jobs', requireAuth, async (req, res) => {
    const { title, description, company, location, salary } = req.body;
    const job = new Job({ title, description, company, location, salary });
    await job.save();

    res.send({ message: 'Job created successfully.' });
});
app.get("/alljobs", async (req, res) => {
    const job = await Job.find({});

    res.send({ message: "Jobs", job });
});

// Update an existing job posting
app.put('/jobs/:id', async (req, res) => {
    const { title, description, company, location, salary } = req.body;
    const job = await Job.findByIdAndUpdate(req.params.id, { title, description, company, location, salary }, { new: true });
    if (!job) return res.status(404).send('Job not found.');

    res.send({ message: 'Job updated successfully.' });
});

// Delete an existing job posting
app.delete('/jobs/:id', async (req, res) => {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).send('Job not found.');

    res.send({ message: 'Job deleted successfully.' });
});

// Search for job postings
app.get('/jobs', async (req, res) => {
    const { title, location, salary } = req.query;
    const filter = {};
    if (title) filter.title = new RegExp(title, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (salary) filter.salary = { $gte: Number(salary) };

    const jobs = await Job.find(filter);
    res.send(jobs);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something went wrong.');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}...`));
