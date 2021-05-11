package main

import (
	"github.com/dghubble/go-twitter/twitter"
	"github.com/dghubble/oauth1"
)

const rootDirectory = "../tweets/"

// "each object within Twitter (tweet, DM, User, List) has a unique id"
// ids are u64
// id based on time, worker number, and sequence number

// 41 time in miliseconds
// 10 machine ID
// 12 sequence number

// this adds up to 63 bits, why?

// which part of this is the most random? I'd guess sequence number and machine ID are mostly low with some outlier highs. Number of seconds is likely more balanced. Minute of the hour is probably unbalanced because of school class schedules
func main() {
	config := oauth1.NewConfig("consumerKey", "consumerSecret")
	token := oauth1.NewToken("accessToken", "accessSecret")
	httpClient := config.Client(oauth1.NoContext, token)

	// Twitter client
	client := twitter.NewClient(httpClient)

	// Home Timeline
	tweets, resp, err := client.Timelines.HomeTimeline(&twitter.HomeTimelineParams{
		Count: 20,
	})

	// Send a Tweet
	tweet, resp, err := client.Statuses.Update("just setting up my twttr", nil)

	// Status Show
	tweet, resp, err := client.Statuses.Show(585613041028431872, nil)

	// Search Tweets
	search, resp, err := client.Search.Tweets(&twitter.SearchTweetParams{
		Query: "gopher",
	})

	// User Show
	user, resp, err := client.Users.Show(&twitter.UserShowParams{
		ScreenName: "dghubble",
	})

	// Followers
	followers, resp, err := client.Followers.List(&twitter.FollowerListParams{})
}
