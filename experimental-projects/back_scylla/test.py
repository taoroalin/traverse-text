
#!/usr/bin/python
#
# A simple example of connecting to a cluster
# To install the driver Run pip install scylla-driver
from cassandra.cluster import Cluster, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy, TokenAwarePolicy
from cassandra.auth import PlainTextAuthProvider


def getCluster():
    profile = ExecutionProfile(load_balancing_policy=TokenAwarePolicy(DCAwareRoundRobinPolicy(local_dc='AWS_US_EAST_1')))

    return Cluster(
        execution_profiles={EXEC_PROFILE_DEFAULT: profile},
        contact_points=[
            "52.200.182.187", "34.198.56.242", "54.85.129.50"
        ],
        port=9042,
        auth_provider = PlainTextAuthProvider(username='scylla', password='vY8ET1iJwMusn6X'))

print('Connecting to cluster')
cluster = getCluster()
session = cluster.connect()



print('Connected to cluster %s' % cluster.metadata.cluster_name)

print('Getting metadata')
for host in cluster.metadata.all_hosts():
    print('Datacenter: %s; Host: %s; Rack: %s' % (host.datacenter, host.address, host.rack))

rows = session.execute('SELECT OwnerId FROM owners WHERE GraphId=?')
for user_row in rows:
    print user_row.name, user_row.age, user_row.email

cluster.shutdown()
