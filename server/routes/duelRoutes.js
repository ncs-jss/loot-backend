const Duel= require('../.././app/models/duel');
const User= require('../.././app/models/user');
const config=require('.././config/config');
const express=require('express');
const router=express.Router();
const fcm_node=require('fcm-node');
var FCM=new fcm_node(process.env.serverKey);


authenticate=function(req,res,next){
	try{

		decoded= jwt.verify(req.header('x-auth'),process.env.JWT_SECRET);
		if(decoded.username==process.env.USERNAME&&decoded.password==process.env.PASSWORD){

			next();
		}
		else{
			res.status(401).send();	
		}

	}catch(e){
		res.status(401).send();
	}	
};


router.route('/')
/**
 * @api {get} /api/user/leaderboard Return leaderboard
 * @apiGroup Users
 * @apiHeader {String} Authorization Token of admin
 * @apiHeaderExample {json} Header
 * {"x-auth": "JWT xyz.abc.123.hgf"}
 * @apiSuccess {String[]} users User list
 * @apiSuccess {String} users.name User name
 * @apiSuccess {String[]} users.admission_no User admission_no
 * @apiSuccess {String[]} users.questions_solved User Questions Solved
 * @apiSuccessExample {json} Success
 * 	HTTP/1.1 200 OK
 *		[{
 *		        "name": "Shubham",
 *		        "admission_no": "17EC060",
 *		        "questions_solved": 3
 *		}]
 * @apiErrorExample {json} Find error
 * 	HTTP/1.1 401 NOT Authenticated
*/
	.get(async function(req,res){
		var duels=await Duel.find();
		res.send(duels);
	})

	.post(async function(req,res){
		var duel= new Duel(req.body);
		duel.id=duel._id;
		var challenger=await User.findOne({reference_token:duel.challenger_rt});
		var opponent=await User.findOne({reference_token:duel.opponent_rt});
		if(parseInt(duel.stake)>challenger.score||parseInt(duel.stake)>opponent.score||parseInt(duel.stake)<=0){
			return res.status(404).send("Invalid Stake");
		}
		else{
			duel.save().then(function(duel){
				res.send(duel);
			}).catch(function(e){
				res.status(400).send(e);
			});
		}
	});	
router.route('/:id/edit')
/**
 * @api {get} /api/user/leaderboard Return leaderboard
 * @apiGroup Users
 * @apiHeader {String} Authorization Token of admin
 * @apiHeaderExample {json} Header
 * {"x-auth": "JWT xyz.abc.123.hgf"}
 * @apiSuccess {String[]} users User list
 * @apiSuccess {String} users.name User name
 * @apiSuccess {String[]} users.admission_no User admission_no
 * @apiSuccess {String[]} users.questions_solved User Questions Solved
 * @apiSuccessExample {json} Success
 * 	HTTP/1.1 200 OK
 *		[{
 *		        "name": "Shubham",
 *		        "admission_no": "17EC060",
 *		        "questions_solved": 3
 *		}]
 * @apiErrorExample {json} Find error
 * 	HTTP/1.1 401 NOT Authenticated
*/
	.post(async function(req,res){
		var id=req.params.id;
		Duel.findOneAndUpdate({id},req.body).then(async function(duel){
			if(duel.challenger_tap_count!=null&&duel.opponent_tap_count!=null && duel.winner==null){
				var challenger_tap_count=parseInt(duel.challenger_tap_count);
				var opponent_tap_count=parseInt(duel.opponent_tap_count);
				var challenger=await User.findOne({reference_token:duel.challenger_rt});
				var opponent=await User.findOne({reference_token:duel.opponent_rt});				
				if(challenger_tap_count>opponent_tap_count){
					challenger.score+=parseInt(duel.stake);
					challenger.duel_won+=1;
					opponent.score-=parseInt(duel.stake);
					opponent.duel_lost+=1;
					duel.winner=challenger.reference_token;

					//FCM to users

					var data_message= { request_type: "won_message", user: opponent.username };
					send(challenger.fcm_token,data_message);
					data_message.request_type='lost_message';
					data_message.user=challenger.username;
					send(opponent.fcm_token,data_message);







				}
				else if(opponent_tap_count>challenger_tap_count){
					challenger.score-=parseInt(duel.stake);
					challenger.duel_lost+=1;
					opponent.duel_won+=1;
					opponent.score+=parseInt(duel.stake);
					duel.winner=opponent.reference_token;
					//FCM to users
					var data_message= { request_type: "lost_message", user: opponent.username };
					send(challenger.fcm_token,data_message);
					data_message.request_type='won_message';
					data_message.user=challenger.username;
					send(opponent.fcm_token,data_message);

				}
				else{
					duel.winner='tie';
					//FCM to users
					var data_message= { request_type: "tie_message", user: opponent.username };
					send(challenger.fcm_token,data_message);
					data_message.request_type='tie_message';
					data_message.user=challenger.username;
					send(opponent.fcm_token,data_message);

				}
				await challenger.save();
				await opponent.save();
				await duel.save();
				// console.log(challenger);
				// console.log(opponent);
			}
			res.send(duel);
		}).catch(function(e){
			res.status(400).send(e);
		})
	});	

	send=function(registeration_id,data_message){
		var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
	        to: registeration_id, 
	        notification: {
	            title: '', 
	            body: '' 
	        },
	        
	        data: data_message
    	};
    
	    FCM.send(message, function(err, response){
	        if (err) {
	        	res.status(404).send(err);
	            console.log("Something has gone wrong!");
	        } else {
	        	res.send(message);
	            console.log("Successfully sent with response: ", response);
	        }
	    });
	}
module.exports=router;