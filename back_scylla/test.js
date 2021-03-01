const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ["52.200.182.187", "34.198.56.242", "54.85.129.50"],
  localDataCenter: 'AWS_US_EAST_1',
  keyspace: 'stores',
  port:9042,
  credentials:{username:"scylla", password:'vY8ET1iJwMusn6X'}
});

const query0 = 'SELECT OwnerId FROM owners WHERE GraphId=?';
const query = 'SELECT * FROM stores.owners';

client.execute(query0, ["testgraph"])
  .then(result => console.log('User with email %s', result.rows[0].email));
  /*
        execution_profiles={EXEC_PROFILE_DEFAULT: profile},
        contact_points=[
            "52.200.182.187", "34.198.56.242", "54.85.129.50"
        ],
        port=9042,
        auth_provider = PlainTextAuthProvider(username='scylla', password='vY8ET1iJwMusn6X')
  */