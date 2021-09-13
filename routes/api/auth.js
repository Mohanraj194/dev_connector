const express = require('express')
const router = express.Router()
const protectedUser = require('../../middleware/auth');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const {check,validationResult}=require('express-validator')
const jsonwebtoken = require('jsonwebtoken');
const config = require('config');

// route GET api/auth DESC test ACCESS public 
router.get('/', protectedUser, async (req, res) => {
	try {
		//find user by Id and return details except password
		const user = await User.findById(req.user.id).select('-password');

		res.json(user);
		
	} catch (error) {
		console.error(error.message);
		res.status(500).json({ message: error.message });
	}
});

router.post(
	'/',
	[ check('email', 'Please, Enter a valid e-mail...').isEmail(), check('password', 'Password is Required').exists() ],
	async (req, res) => {
		// if user details fails
		const error = validationResult(req);
		if (!error.isEmpty()) return res.status(400).json({ errors: error.array() });

		//destructuring login details from req.body /* frontend */
		const { email, password } = req.body;

		try {
			//find user email, if not exists it returns null
			let user = await User.findOne({ email });

			//user validation => if nto exists throw error
			if (!user) return res.status(404).json({ errors: [ { message: 'Invalid User Credentials' } ] });

			//validate password
			const isPasswordMatch = await bcrypt.compare(password, user.password);

			//if password not matched
			if (!isPasswordMatch) return res.status(404).json({ errors: [ { message: 'Invalid User Credentials' } ] });

			//payload for json web token
			const payload = {
				user: {
					id: user.id
				}
			};

			//create json web token for a unique user
			jsonwebtoken.sign(payload, config.get('jsonwebtokenSecret'), { expiresIn: 360000 }, (error, token) => {
				if (error) throw error;
				res.json({ token });
			});
		} catch (error) {
			console.error(error);
			res.status(500).json('Server Error');
		}
	}
);

module.exports = router