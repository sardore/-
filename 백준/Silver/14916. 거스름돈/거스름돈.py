a=int(input())

#날먹
if a==1:
    print(-1)
    exit()
if a==2:
    print(1)
    exit()
if a==3:
    print(-1)
    exit()
if a==4:
    print(2)
    exit()

coin=[]


# 5코인으로만
if a%5==0:
    print(a//5)
    exit()

# 5코인과 2코인으로
five=a//5
b=a%5
if b%2==0:
    coin.append(five+b//2)


# 5원을 남기고 5코인과 2코인 또는 2코인만으로
five=a//5-1
a=a%5+5

if a%2==0:
    coin.append(five+a//2)

#출력
if coin!=[]:
    print(max(coin))

# 불가능
else:
    print(-1)
