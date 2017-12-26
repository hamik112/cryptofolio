const express = require('express')
const router = express.Router()

const crypto_exchange_wrapper = require('../crypto_exchange_wrapper')
const balances = require('../balances')
const pairs = require('../pairs')
const ticker = require('../ticker')

router.get('/:name/balances/:key/:secret/:currency', function(req, res) {
	list(req.params.name, req.params.key, req.params.secret, req.params.currency).then(function(result) {
		res.status(200).json(result);
	})
})

function list(exchange, key, secret, to_currency) {
	return Promise.all([pairs.list(exchange), balances.list(exchange, key, secret)]).then(([pair_list, balance_list]) => {
		promises = []

		Object.keys(balance_list).map(function(currency, index) {
			balance_list[currency]['conversion_pairs'] = []
			balance_list[currency]['value'] = balance_list[currency]['balance']

			// e.g. from: USDT to: USDT
			if(currency === to_currency) return

			// e.g. from: BTC to: USDT, pair: BTC_USDT
			pair = find_pair(pair_list, currency, to_currency)
			if (pair) {
				promises.push(convert_entry(exchange, pair, currency, balance_list))
				return
			}

			// e.g. from: USDT to: BTC, pair: BTC_USDT
			pair = find_pair(pair_list, to_currency, currency)
			if (pair) {
				promises.push(convert_entry(exchange, pair, currency, balance_list, false))
				return
			}

			// e.g. from: XVG to: USDT, pairs: XVG_BTC, BTC_USDT
			intermediate_currency = 'BTC'
			intermediate_pair = find_pair(pair_list, currency, intermediate_currency)
			pair = find_pair(pair_list, intermediate_currency, to_currency)
			if (intermediate_pair && pair) {
				promises.push(convert_entry(exchange, intermediate_pair, currency, balance_list))
				promises.push(convert_entry(exchange, pair, currency, balance_list))
				return
			}

			console.log(`No pairs found to change from ${currency} to ${to_currency}`)
			delete balance_list[currency]['value']
			delete balance_list[currency]['conversion_pairs']
		})

		return Promise.all(promises).then(() => { return balance_list })
	})
}

function convert_entry(exchange, pair, start_currency, balance_list, direction = true) {
	// pair = find_pair(pair_list, from_currency, to_currency)
	// if (pair) {
		promise = convert(exchange, pair).then(result => {
			if (direction) {
				return balance_list[start_currency]['value'] *= result
			} else {
				return balance_list[start_currency]['value'] /= result
			}
		})
		balance_list[start_currency]['conversion_pairs'].push(pair)
		return promise
	// }
}

function convert(exchange, pair) {
	return ticker.last_value(exchange, pair).then(result => {
		return result
	})
}

function find_pair(pairs, from_currency, to_currency) {
  for (var i in pairs) {
    pair = pairs[i].split('_')
    if (pair[0] == from_currency && pair[1] == to_currency) {
      return pairs[i]
    }
  }
}

module.exports = {
	router: router,
	list: list
}
