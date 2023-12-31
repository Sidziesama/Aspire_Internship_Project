/* This file is used to register a user onto the database. 
* It validates the user inputs and then onboards the user onto the databse
*/

const router = require('express').Router();
const { User, validate } = require('../Models/user');
const bcrypt = require('bcrypt');
const sendEmail = require('../utilities/sendEmail');
const generateOTP = require('../utilities/otp');

/** Registration 
 * firstName, lastName, username, email, password, confirmPassword, collegeName
 */
router.post('/', async (req, res) => {

  try {

    const { error } = validate(req.body);
    if (error)
      return res.status(400).send({ message: error.details[0].message });

    // Check if mail already exists. If it does, display "User Already exists message". 
    user_mail = await User.findOne({ email: req.body.email });
    if (user_mail)
      return res.status(409).send({ message: "User with this mail id already exists!" });

    // Check if username already exists. If it does, display "Username already exists".
    const user_name = await User.findOne({ username: req.body.username })
    if (user_name)
      return res.status(409).send({ message: "Username already exists!" });

    // Check if password and confirm password match. If not, throw error.   
    if (req.body.password !== req.body.confirmPassword)
      return res.status(400).send({ message: "Password and confirm password do not match!" });

    // Encrypting the password to add an extra layer of security. The password will appear in an encrpted manner in the database.
    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    const hashConfirmPassword = await bcrypt.hash(req.body.confirmPassword, salt);

    // Generating a 25 digit alphanumeric OTP for email verification
    const otp = generateOTP(25);

    await new User({ ...req.body, password: hashPassword, confirmPassword: hashConfirmPassword, otp: otp }).save();


    // Send OTP to the user's email
    const subject = 'OTP For Account Verification at Sidzies Website';
    const text = `Your OTP for email verification is: ${otp}`;
    await sendEmail(req.body.email, subject, text);

    res.status(201).send({
      message: "User created successfully",
      verificationMessage: "An OTP has been sent to your email. Please verify your credentials using the received OTP."
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// User Email verification using OTP 
router.post('/verification', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Check if the user exists in the database. If user does not exist, throw error.
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Compare the OTPs
    if (otp === user.otp) {
      // OTP matched, email verified
      user.isVerified = true;
      await user.save();

      // Return success response
      res.status(200).send({ message: 'Email verified successfully' });
    } else {
      // OTP didn't match
      res.status(400).send({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: 'Failed to verify OTP' });
  }
});

module.exports = router;
