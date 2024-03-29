#lang racket/base
(require rackunit
         rackunit/text-ui
         "workout-types.rkt"
         "cable.rkt"
         "dumbbell.rkt"
         "lat-machine.rkt"
         "barbell.rkt")

(define (test-resistance resistance test-name)
  (run-tests (test-suite
   test-name
   (let ([max-level (resistance-max-level resistance)]
         [get-level (resistance-get-level resistance)]
         [get-weight (resistance-get-weight resistance)])
     (let ([lst (build-list (add1 max-level) values)])
       (for-each
        (lambda (level)
          (check = (get-level (get-weight level)) level))
        lst))
     (let ([lst (build-list (add1 max-level) (λ (x) (get-weight x)))])
       (for-each
        (lambda (weight)
          (check = (get-weight (get-level weight)) weight))
        lst))))))

(test-resistance LAT-MACHINE "Lat Machine Tests")
(test-resistance DUMBBELL "Dumbbell Tests")
(test-resistance CABLE "Cable Tests")
(test-resistance BARBELL "Barbell Tests")
