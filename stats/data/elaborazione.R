library(readr)
library(ggplot2)
library(dplyr)
library(lubridate)
setwd("~/Projects/Bitcoin-Thesis/stats/data")

hash_rate <- read_csv("~/Projects/Bitcoin-Thesis/stats/data/hash-rate.csv", 
                      col_names = FALSE, col_types = cols(X1 = col_character(), 
                                                          X2 = col_character()))
blocksize <- read_csv("~/Projects/Bitcoin-Thesis/stats/data/blocksize.csv", 
                      col_names = FALSE, col_types = cols(X1 = col_character()))
difficulty <- read_csv("~/Projects/Bitcoin-Thesis/stats/data/difficulty.csv", 
                      col_names = FALSE, col_types = cols(X1 = col_character(), 
                                                          X2 = col_character()))
interval <- read_csv("~/Projects/Bitcoin-Thesis/stats/data/interval.csv")

n_orphaned_blocks <- read_csv("~/Projects/Bitcoin-Thesis/stats/data/n-orphaned-blocks.csv", 
                      col_names = FALSE, col_types = cols(X1 = col_character(), 
                                                          X2 = col_character()))

ggplot(blocksize, aes(x=as.POSIXct(X1), y=as.numeric(X2))) +
          geom_point()

names(interval) <- c("X1","X2")
ggplot(interval, aes(x=as.POSIXct(X1), y=as.numeric(X2))) +
  geom_point()

ggplot(n_orphaned_blocks, aes(x=as.POSIXct(X1), y=as.numeric(X2))) +
  geom_point()

interval$X1 <- paste(interval$X1, "00:00:00")
interval$X1 <- as.POSIXct(interval$X1)
blocksize$X1 <- as.POSIXct(blocksize$X1)
tmp <- full_join(blocksize, interval, by = "X1")
names(tmp) <- c("X1","blocksize","interval")

n_orphaned_blocks$X1 <- as.POSIXct(n_orphaned_blocks$X1)
tmp <- full_join(tmp, n_orphaned_blocks, by = "X1")
names(tmp) <- c("X1","blocksize","interval", "ophaned_blocks")

hash_rate$X1 <- as.POSIXct(hash_rate$X1)
hash_rate$X2 <- as.numeric(hash_rate$X2)
tmp <- full_join(tmp, hash_rate, by = "X1")
names(tmp) <- c("X1","blocksize","interval", "ophaned_blocks", "hash_rate") 

difficulty$X1 <- as.POSIXct(difficulty$X1)
difficulty$X2 <- as.numeric(difficulty$X2)
tmp <- full_join(tmp, difficulty, by = "X1")
names(tmp) <- c("date","blocksize","interval", "ophaned_blocks", "hash_rate", "difficulty") 

tmp$date <- as.POSIXlt(tmp$date)
tmp$interval <- as.numeric(tmp$interval)
tmp$blocksize <- as.numeric(tmp$blocksize)
tmp$ophaned_blocks <- as.numeric(tmp$ophaned_blocks)
tmp$prob_1 <- if_else(tmp$ophaned_blocks==1,1,0)
tmp$prob_2 <- if_else(tmp$ophaned_blocks==2,1,0)
tmp$prob_3 <- if_else(tmp$ophaned_blocks==3,1,0)
tmp$prob_4 <- if_else(tmp$ophaned_blocks==4,1,0)

tmp <- na.omit(tmp)

# ggplot(tmp, aes(x=interval, y=ophaned_blocks), alpha=0.01)+
#   geom_point() +
#   geom_point(aes(y=predict, color='red'))
# 
# ggplot(tmp, aes(x=difficulty, y=hashrate, color=as.factor(year(tmp$date)), alpha=0.01))+
#   geom_point()

fit <- lm(prob_1 ~ difficulty + interval + blocksize, data=tmp)
tmp$predict_1 <- predict(fit)

fit <- lm(prob_2 ~ difficulty + interval + blocksize, data=tmp)
tmp$predict_2 <- predict(fit)

fit <- lm(prob_3 ~ difficulty + interval + blocksize, data=tmp)
tmp$predict_3 <- predict(fit)

fit <- lm(prob_4 ~ difficulty + interval + blocksize, data=tmp)
tmp$predict_4 <- predict(fit)

ggplot(tmp, aes(x=difficulty, y=ophaned_blocks), alpha=0.01)+
  # geom_point() + 
  geom_point(aes(y=predict_1, color='one')) +
  geom_smooth(aes(y=predict_1, color='one'), method = "lm") +
  geom_point(aes(y=predict_2, color='two'))+
  geom_smooth(aes(y=predict_2, color='two'), method = "lm") +
  geom_point(aes(y=predict_3, color='three'))+
  geom_smooth(aes(y=predict_3, color='three'), method = "lm") +
  geom_point(aes(y=predict_4, color='four'))+
  geom_smooth(aes(y=predict_4, color='four'), method = "lm")

ggplot(tmp, aes(x=interval, y=ophaned_blocks), alpha=0.01)+
  #geom_point() +
  geom_point(aes(y=predict_1, color='one')) +
  geom_smooth(aes(y=predict_1, color='one'), method = "lm") +
  geom_point(aes(y=predict_2, color='two'))+
  geom_smooth(aes(y=predict_2, color='two'), method = "lm") +
  geom_point(aes(y=predict_3, color='three'))+
  geom_smooth(aes(y=predict_3, color='three'), method = "lm") +
  geom_point(aes(y=predict_4, color='four')) +
  geom_smooth(aes(y=predict_4, color='four'), method = "lm") 

ggplot(tmp, aes(x=difficulty, y=ophaned_blocks), alpha=0.01)+
  # geom_point() +
  geom_point(aes(y=predict_1, color='one')) +
  geom_smooth(aes(y=predict_1, color='one'), method = "lm") +
  geom_point(aes(y=predict_2, color='two'))+
  geom_smooth(aes(y=predict_2, color='two'), method = "lm") +
  geom_point(aes(y=predict_3, color='three'))+
  geom_smooth(aes(y=predict_3, color='three'), method = "lm") +
  geom_point(aes(y=predict_4, color='four')) +
  geom_smooth(aes(y=predict_4, color='four'), method = "lm") 


ggplot(tmp, aes(x=interval, y=blocksize, color=as.factor(ophaned_blocks)), alpha=0.01)+
  geom_point()

ggplot(tmp, aes(x=hash_rate, y=difficulty, color=as.factor(ophaned_blocks)), alpha=0.01)+
  geom_point()

ggplot(tmp, aes(x=interval, y=difficulty, color=as.factor(ophaned_blocks)), alpha=0.01)+
  geom_point()

ggplot(tmp, aes(x=hash_rate, y=blocksize, color=as.factor(ophaned_blocks)), alpha=0.01)+
  geom_point()

ggplot(tmp, aes(x=hash_rate, y=difficulty, color=as.factor(ophaned_blocks)), alpha=0.01)+
  geom_point()
