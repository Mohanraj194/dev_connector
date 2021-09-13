const express = require('express')
const router = express.Router()
const protectedUser = require('../../middleware/auth');
const ProfileCollection = require('../../models/Profile');
const UserCollection = require('../../models/User');
const PostCollection = require('../../models/Post');
const {check,validationResult}=require('express-validator')
const checkUrlObjectId = require('../../middleware/checkId');
const axios = require('axios');
const config = require('config');

// route GET api/profile DESC current user profile ACCESS private 
router.get('/me', protectedUser, async (req, res) => {
	try {
		//find a user profile by ID (from token)
		const profile = await ProfileCollection.findOne({
			user: req.user.id
		}).populate('user', [ 'name', 'avatar' ]);

		if (!profile)
			return res.status(400).json({
				message: 'There is no profile for this user'
			});

		res.json(profile);
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server Error');
	}
});

router.post(
	'/',
	protectedUser,
	check('status', 'Status is required').notEmpty(),
	check('skills', 'Skills is required').notEmpty(),
	async (req, res) => {
	  const errors = validationResult(req);
	  if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	  }
  
	  // destructure the request
	  const {
		website,
		skills,
		youtube,
		twitter,
		instagram,
		linkedin,
		facebook,
		// spread the rest of the fields we don't need to check
		...rest
	  } = req.body;
  
	  // build a profile
	  const profileFields = {
		user: req.user.id,
		website:
		  website && website !== ''
			? normalize(website, { forceHttps: true })
			: '',
		skills: Array.isArray(skills)
		  ? skills
		  : skills.split(',').map((skill) => ' ' + skill.trim()),
		...rest
	  };
  
	  // Build socialFields object
	  const socialFields = { youtube, twitter, instagram, linkedin, facebook };
  
	  // normalize social fields to ensure valid url
	  for (const [key, value] of Object.entries(socialFields)) {
		if (value && value.length > 0)
		  socialFields[key] = normalize(value, { forceHttps: true });
	  }
	  // add to profileFields
	  profileFields.social = socialFields;
  
	  try {
		// Using upsert option (creates new doc if no match is found):
		let profile = await ProfileCollection.findOneAndUpdate(
		  { user: req.user.id },
		  { $set: profileFields },
		  { new: true, upsert: true, setDefaultsOnInsert: true }
		);
		return res.json(profile);
	  } catch (err) {
		console.error(err.message);
		return res.status(500).send('Server Error');
	  }
	}
  );

  router.get('/', async (req, res) => {
	try {
		const profiles = await ProfileCollection.find().populate('user', [ 'name', 'avatar' ]);
		res.json(profiles);
	} catch (err) {
		console.error(err.message);
		res.status(500).send('Server Error');
	}
});



router.get('/user/:user_id', checkUrlObjectId('user_id'), async ({ params: { user_id } }, res) => {
	try {
		const profile = await ProfileCollection.findOne({
			user: user_id
		}).populate('user', [ 'name', 'avatar' ]);

		if (!profile)
			return res.status(400).json({
				message: 'Profile not found'
			});

		return res.json(profile);
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.delete('/', protectedUser, async (req, res) => {
	try {
	  // Remove user posts
	  // Remove profile
	  // Remove user
	  await Promise.all([
		PostCollection.deleteMany({ user: req.user.id }),
		ProfileCollection.findOneAndRemove({ user: req.user.id }),
		UserCollection.findOneAndRemove({ _id: req.user.id })
	  ]);
  
	  res.json({ msg: 'User deleted' });
	} catch (err) {
	  console.error(err.message);
	  res.status(500).send('Server Error');
	}
  });

  router.put(
	'/experience',
	protectedUser,
	[
		check('title', 'Title is required').notEmpty(),
		check('company', 'Company Name is required').notEmpty(),
		check('from', 'From date is required and needs to be from the past')
			.notEmpty()
			.custom((value, { req }) => (req.body.to ? value < req.body.to : true))
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				errors: errors.array()
			});
		}

		try {
			const profile = await ProfileCollection.findOne({
				user: req.user.id
			});

			profile.experience.unshift(req.body); //adding profile to first of experience array

			await profile.save();

			res.json(profile);
		} catch (err) {
			console.error(err.message);
			res.status(500).send('Server Error');
		}
	}
);

router.delete('/experience/:experience_id', protectedUser, async (req, res) => {
	try {
		const profile = await ProfileCollection.findOne({
			user: req.user.id
		});

		profile.experience = profile.experience.filter((exp) => exp._id.toString() !== req.params.experience_id);

		await profile.save();
		console.log(profile);
		return res.status(200).json(profile);
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server Error');
	}
});


router.put(
	'/education',
	protectedUser,
	[
		check('school', 'School is required').notEmpty(),
		check('degree', 'Degree is required').notEmpty(),
		check('fieldofstudy', 'Field of study is required').notEmpty(),
		check('from', 'From date is required and needs to be from the past')
			.notEmpty()
			.custom((value, { req }) => (req.body.to ? value < req.body.to : true))
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				errors: errors.array()
			});
		}

		try {
			const profile = await ProfileCollection.findOne({
				user: req.user.id
			});

			profile.education.unshift(req.body);

			await profile.save();

			res.json(profile);
		} catch (err) {
			console.error(err.message);
			res.status(500).send('Server Error');
		}
	}
);



router.delete('/education/:education_id', protectedUser, async (req, res) => {
	try {
		const profile = await ProfileCollection.findOne({
			user: req.user.id
		});
		profile.education = profile.education.filter(
			(education) => education._id.toString() !== req.params.education_id
		);
		await profile.save();
		return res.status(200).json(profile);
	} catch (error) {
		console.error(error.message);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/github/:username', async (req, res) => {
	try {
		const uri = `https://api.github.com/users/${req.params
			.username}/repos?per_page=10&sort=created:asc&client_id=${config.get(
			'githubClientId'
		)}&client_secret=${config.get('githubSecretKey')}`;

		const headers = {
			'user-agent': 'node.js'
		};

		const repos = await axios.get(
			uri,
			{
				method: 'GET'
			},
			{
				headers
			}
		);

		return res.json(repos.data);
	} catch (error) {
		console.error(error.message);
		return res.status(404).json({
			message: 'No GitHub User Found'
		});
	}
});


module.exports = router