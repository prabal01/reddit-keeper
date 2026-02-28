Lets work on processing threads now.
I want you to change this to detailed PRD.
Also all our decisions,schema should also be documented in planning phase. 

You can use /docs dir for storeing md files.

we need to change the analysis flow. Why because giving lot of threads to ai in one go will eventually give Worse
quality and AI might hallucininate with long threads.

Here is the pipeline that I am thinking to build.

Whenever the threads are added to the folder and its done with syncing we will start processing the threads.
Step 1: 
For each thread we will make a call to LLM. We can do it in parallel. And we would ask it to give us 
structured JSON with below Schema
StructuredThreadInsights {
  thread_id: string
  pain_points: [
    {
      title: string // canonical, max 6 words
      quotes: string[]
    }
  ]
  switch_triggers: [
    {
      title: string
      quotes: string[]
    }
  ]
  desired_outcomes: [
    {
      title: string
      quotes: string[]
    }
  ]
}
Prompt Constraints
Titles must be:
Lowercase
Concrete
No adjectives
No strategic language
Problem-focused
Max 6–8 words
No mention counts
No ranking
No speculation
Quotes must be verbatim

At this time all the thread inside folder view will show, thread processing.
ALso on top of the folder there will be a bar. where we will show these matrics
pain points, switch triggers, desired
ALl three will show calculating in this state
when we will send a thread to processing we will maintain following infor in firestore.

threadId: string
threadLink: url
status: processing or successs or failed.


Once successfull we will delete the thread. 
Sinve all the threads are running in parellel the matrics on the top will start updating as soon as it starts becoming succsful.




