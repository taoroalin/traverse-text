

/*

Tables:


{
  Pages:
  GraphId PageId | PageTitle EditUser CreateUser EditTime CreateTime

  Blocks:
  GraphId BlockId | BlockString EditUser CreateUser EditTime CreateTime

  Kids:
  GraphId ParentId ChildId |

  Inter Graph Links
  GraphId BlockId GraphId |
}

{
  GraphId Id | String Parent Kids CrossGraphBackRefs edit create

CREATE TYPE stores.write(string text, time timestamp, user UUID)
CREATE TABLE stores.blox(GraphId text, Id text, FROZEN<write>, Parent text, PRIMARY KEY(GraphId, Id));

CREATE TABLE stores.owners (GraphId text, OwnerId UUID, PRIMARY KEY(GraphId, OwnerId));

INSERT INTO stores.owners (GraphId, OwnerId) VALUES ('testgraph', 5b6962dd-3f90-4c93-8f61-eabfa4a803e2)

CREATE TABLE stores.kids (GraphId text, Id text, Kids list<text>, PRIMARY KEY(GraphId, Id));

}


CREATE KEYSPACE IF NOT EXISTS stores;

CREATE TABLE cycling.cyclist_alt_stats ( id UUID PRIMARY KEY, lastname text, birthday timestamp, nationality text, weight text, height text );



*/