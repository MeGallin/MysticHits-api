const mongoose = require('mongoose');
const PlayEvent = require('./models/PlayEvent');

// Connect to MongoDB
require('./config/db');

async function checkTitles() {
  try {
    console.log('Checking PlayEvent titles in database...');

    // Get some sample titles to see what's in the database
    const events = await PlayEvent.find().limit(10).select('title trackUrl');

    console.log('\nSample titles from database:');
    events.forEach((event, index) => {
      console.log(
        `${index + 1}. "${event.title}" (Length: ${event.title?.length || 0})`,
      );
    });

    // Check for any titles that might be truncated (look for patterns)
    const truncatedPattern = await PlayEvent.find({
      $or: [
        { title: /\.\.\.$/ }, // ends with ...
        { title: /…$/ }, // ends with ellipsis
      ],
    })
      .limit(5)
      .select('title');

    if (truncatedPattern.length > 0) {
      console.log('\nFound potentially truncated titles:');
      truncatedPattern.forEach((event, index) => {
        console.log(`${index + 1}. "${event.title}"`);
      });
    } else {
      console.log('\nNo obviously truncated titles found');
    }

    // Get the aggregation result to see what the API would return
    console.log('\nTesting aggregation (top 5 tracks):');
    const topTracks = await PlayEvent.aggregate([
      {
        $group: {
          _id: '$trackUrl',
          count: { $sum: 1 },
          title: { $first: '$title' },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          _id: 0,
          trackUrl: '$_id',
          title: 1,
          count: '$count',
        },
      },
    ]);

    topTracks.forEach((track, index) => {
      console.log(
        `${index + 1}. "${track.title}" (${track.count} plays) - Length: ${
          track.title?.length || 0
        }`,
      );
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkTitles();
